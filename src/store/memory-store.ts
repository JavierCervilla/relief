/**
 * Store en memoria. Es el que usa el esqueleto y el que usan los tests.
 *
 * Clona lo que entra y lo que sale. Sin eso, quien llame puede mutar una tarea guardada por la puerta de
 * atrás y los tests pasan por accidente en vez de por diseño — que es justo el fallo que un store en
 * memoria hace fácil y una base de datos hace imposible.
 *
 * ── DÓNDE ESTÁ LA ATOMICIDAD ────────────────────────────────────────────────────────────────────
 *
 * `tryClaim`, `trySubmit` y `tryRelease` están declarados `async` porque la interfaz lo exige, pero sus
 * cuerpos **no contienen ni un `await`**. En el bucle de eventos de Node eso significa que se ejecutan
 * enteros sin ceder el control: entre la comprobación y la escritura no hay ventana por la que se cuele
 * otra llamada. Ésa es toda la garantía, y es exactamente la que se perdía cuando la decisión vivía en
 * el servicio con `await` de por medio.
 *
 * **No metas un `await` en estos tres métodos.** Si alguna vez hace falta E/S asíncrona aquí dentro, la
 * atomicidad deja de ser gratis y hay que sustituirla por algo explícito, no reintroducirla por
 * descuido. La implementación contra Postgres usará una transacción para lo mismo.
 */

import type { Claim, Submission, Task } from "../schema/task.js";
import type {
  ClaimEvent,
  ClaimRequest,
  ClaimResult,
  ReleaseResult,
  SubmitRequest,
  SubmitResult,
  TaskStore,
} from "./task-store.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryTaskStore implements TaskStore {
  readonly #tasks = new Map<string, Task>();
  readonly #claims = new Map<string, Claim>();
  readonly #claimEvents: ClaimEvent[] = [];
  readonly #submissions: Submission[] = [];

  constructor(tasks: readonly Task[] = []) {
    for (const task of tasks) this.#tasks.set(task.id, clone(task));
  }

  async listTasks(): Promise<Task[]> {
    return [...this.#tasks.values()].map(clone);
  }

  async getTask(taskId: string): Promise<Task | undefined> {
    const task = this.#tasks.get(taskId);
    return task === undefined ? undefined : clone(task);
  }

  async saveTask(task: Task): Promise<void> {
    this.#tasks.set(task.id, clone(task));
  }

  async getClaim(taskId: string): Promise<Claim | undefined> {
    const claim = this.#claims.get(taskId);
    return claim === undefined ? undefined : clone(claim);
  }

  async listClaims(): Promise<Claim[]> {
    return [...this.#claims.values()].map(clone);
  }

  async deleteClaim(taskId: string): Promise<void> {
    this.#claims.delete(taskId);
  }

  // ---------------------------------------------------------------------------
  // Las tres decisiones atómicas. Sin `await` dentro. Ver la cabecera.
  // ---------------------------------------------------------------------------

  async tryClaim(request: ClaimRequest): Promise<ClaimResult> {
    const task = this.#tasks.get(request.taskId);
    if (task === undefined) return { outcome: "task_not_found" };

    // Reintentar tras un corte de red no es un error y no vuelve a consumir cuota: se comprueba lo
    // primero, antes incluso que el estado de la tarea.
    const existing = this.#claims.get(request.taskId);
    if (existing !== undefined) {
      return existing.volunteerId === request.volunteerId
        ? { outcome: "already_yours", claim: clone(existing) }
        : { outcome: "claimed_by_other", claim: clone(existing) };
    }

    if (task.status !== "open") return { outcome: "task_not_available", status: task.status };

    const inSession = this.#claimEvents.filter(
      (event) => event.sessionId === request.sessionId,
    ).length;
    if (inSession >= request.maxClaimsPerSession) return { outcome: "session_quota_exceeded" };

    const today = this.#claimEvents.filter(
      (event) => event.volunteerId === request.volunteerId && event.at >= request.dayStartIso,
    ).length;
    if (today >= request.maxClaimsPerDay) return { outcome: "daily_quota_exceeded" };

    // El tope de parches se comprueba AQUÍ dentro, con los otros dos, y no en el servicio: si viviera
    // fuera volvería a abrirse la ventana que RELE-1 cerró, y sería peor — un parche de más no es una
    // tarea de más, es una tarde de un mantenedor.
    if (task.type === "patch") {
      const patches = this.#claimEvents.filter(
        (event) => event.sessionId === request.sessionId && event.taskType === "patch",
      ).length;
      if (patches >= request.maxPatchClaimsPerSession) return { outcome: "patch_quota_exceeded" };
    }

    const claim: Claim = {
      taskId: request.taskId,
      volunteerId: request.volunteerId,
      sessionId: request.sessionId,
      claimedAt: request.claimedAt,
      expiresAt: request.expiresAt,
    };
    this.#claims.set(claim.taskId, clone(claim));
    this.#tasks.set(task.id, { ...clone(task), status: "claimed" });
    this.#claimEvents.push({
      taskId: request.taskId,
      volunteerId: request.volunteerId,
      sessionId: request.sessionId,
      at: request.claimedAt,
      taskType: task.type,
    });
    return { outcome: "claimed", claim };
  }

  async trySubmit(request: SubmitRequest): Promise<SubmitResult> {
    const claim = this.#claims.get(request.taskId);
    if (claim === undefined) return { outcome: "no_claim" };
    if (claim.volunteerId !== request.volunteerId) return { outcome: "claimed_by_other" };

    const task = this.#tasks.get(request.taskId);
    // Un claim vivo sin tarea es imposible por construcción; si pasara, no inventamos un envío.
    if (task === undefined) return { outcome: "no_claim" };

    const submission: Submission = {
      taskId: request.taskId,
      volunteerId: request.volunteerId,
      sessionId: request.sessionId,
      submittedAt: request.submittedAt,
      result: clone(request.result),
      reviewedByHuman: true,
    };
    this.#submissions.push(clone(submission));
    this.#tasks.set(task.id, { ...clone(task), status: "submitted" });
    // El claim se retira: la tarea ya no está en manos de nadie, está esperando a la ONG.
    this.#claims.delete(request.taskId);
    return { outcome: "submitted", submission };
  }

  async tryRelease(taskId: string, volunteerId: string): Promise<ReleaseResult> {
    const claim = this.#claims.get(taskId);
    if (claim === undefined) return { outcome: "no_claim" };
    if (claim.volunteerId !== volunteerId) return { outcome: "claimed_by_other" };

    const task = this.#tasks.get(taskId);
    if (task === undefined) return { outcome: "no_claim" };

    this.#claims.delete(taskId);
    this.#tasks.set(task.id, { ...clone(task), status: "open" });
    return { outcome: "released" };
  }

  // ---------------------------------------------------------------------------

  async countClaimsInSession(sessionId: string): Promise<number> {
    return this.#claimEvents.filter((event) => event.sessionId === sessionId).length;
  }

  async countPatchClaimsInSession(sessionId: string): Promise<number> {
    return this.#claimEvents.filter(
      (event) => event.sessionId === sessionId && event.taskType === "patch",
    ).length;
  }

  async countClaimsForVolunteerSince(volunteerId: string, sinceIso: string): Promise<number> {
    return this.#claimEvents.filter(
      (event) => event.volunteerId === volunteerId && event.at >= sinceIso,
    ).length;
  }

  async listSubmissions(): Promise<Submission[]> {
    return this.#submissions.map(clone);
  }
}
