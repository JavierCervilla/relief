/**
 * Las cinco operaciones del voluntario y, sobre todo, los invariantes que las gobiernan.
 *
 * Esta clase es donde vive la lógica; `mcp.ts` sólo la expone como tools. La separación no es ceremonia:
 * permite probar los invariantes sin levantar un servidor MCP ni hablar por stdio, que es la diferencia
 * entre una batería de tests que se corre en cada edición y una que no se corre.
 *
 * Los cinco invariantes (ver el Design Doc §3.3):
 *
 *   1. Un claim, un voluntario. Reclamar lo de otro falla; reclamar lo tuyo es idempotente.
 *   2. El claim caduca a los 30 minutos y la tarea vuelve sola a la cola.
 *   3. ≤3 claims por sesión y ≤10 por voluntario y día. Se cuentan claims, no envíos.
 *   4. `submit_result` exige un claim vivo y tuyo, y falla diciendo por qué.
 *   5. El contenido de la tarea sale siempre delimitado como material no confiable.
 */

import {
  LIMITS,
  type Claim,
  type Quota,
  type Submission,
  type Task,
  type TaskSummary,
  type ListTasksInput,
  type GetTaskInput,
  type ClaimTaskInput,
  type ReleaseTaskInput,
  type SubmitResultInput,
} from "../schema/task.js";
import type { TaskStore } from "../store/task-store.js";
import { RelevoError } from "./errors.js";
import { wrapUntrusted } from "./untrusted.js";

/** Quién está trabajando y en qué sesión. En stdio, un proceso del servidor es una sesión. */
export interface SessionContext {
  volunteerId: string;
  sessionId: string;
}

export interface ServiceOptions {
  /**
   * El reloj, inyectable. La caducidad del claim es un invariante que depende del tiempo, y un test que
   * lo comprueba esperando media hora no es un test.
   */
  now?: () => Date;
}

/**
 * La frase que el voluntario pega en el PR o el comentario para avisar de que hay IA detrás.
 *
 * La redacta el servidor, no la skill, por la misma razón que los límites de cuota viven aquí: una skill
 * se edita. Y va literal para que no haya que redactarla bajo presión — la forma que los mantenedores
 * piden es una frase sencilla, no un formulario.
 */
export function disclosureFor(task: Task): string {
  const base =
    "Este trabajo se preparó con ayuda de IA generativa (Claude) y lo ha revisado una persona antes de enviarlo, a través de Relevo.";
  return task.type === "patch"
    ? `${base} El cambio se hizo sobre una issue que el proyecto marcó como abierta a ayuda de IA.`
    : base;
}

/** Medianoche UTC del día de `at`, que es el corte del límite diario. */
function startOfUtcDay(at: Date): string {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())).toISOString();
}

export class RelevoService {
  readonly #store: TaskStore;
  readonly #session: SessionContext;
  readonly #now: () => Date;

  constructor(store: TaskStore, session: SessionContext, options: ServiceOptions = {}) {
    this.#store = store;
    this.#session = session;
    this.#now = options.now ?? (() => new Date());
  }

  // -------------------------------------------------------------------------
  // Invariante 2 — caducidad
  // -------------------------------------------------------------------------

  /**
   * Devuelve a la cola los claims vencidos.
   *
   * Se hace **al principio de cada operación**, no con un temporizador, porque en el esqueleto no hay un
   * proceso de servidor que viva entre llamadas: el store es de memoria y el servidor stdio muere con la
   * sesión. Cuando entre la persistencia (fase 2) esto pasa a ser trabajo del servidor, y el ROADMAP lo
   * dice; mientras tanto, hacerlo aquí es lo que hace el invariante cierto **en el momento en que
   * alguien mira**, que es el único momento en que se puede observar.
   */
  async #expireStaleClaims(): Promise<Set<string>> {
    const nowIso = this.#now().toISOString();
    const expired = new Set<string>();
    for (const claim of await this.#store.listClaims()) {
      if (claim.expiresAt > nowIso) continue;
      await this.#store.deleteClaim(claim.taskId);
      expired.add(claim.taskId);
      const task = await this.#store.getTask(claim.taskId);
      // Una tarea ya enviada no vuelve a la cola porque su claim caduque: el trabajo está hecho.
      if (task !== undefined && task.status === "claimed") {
        await this.#store.saveTask({ ...task, status: "open" });
      }
    }
    return expired;
  }

  // -------------------------------------------------------------------------
  // Invariante 3 — cuota
  // -------------------------------------------------------------------------

  async #quota(): Promise<Quota> {
    const { volunteerId, sessionId } = this.#session;
    return {
      claimsThisSession: await this.#store.countClaimsInSession(sessionId),
      maxClaimsPerSession: LIMITS.maxClaimsPerSession,
      claimsToday: await this.#store.countClaimsForVolunteerSince(
        volunteerId,
        startOfUtcDay(this.#now()),
      ),
      maxClaimsPerDay: LIMITS.maxClaimsPerDay,
    };
  }

  // -------------------------------------------------------------------------
  // list_tasks
  // -------------------------------------------------------------------------

  async listTasks(input: ListTasksInput): Promise<{ tasks: TaskSummary[]; quota: Quota }> {
    await this.#expireStaleClaims();
    const tasks = (await this.#store.listTasks())
      .filter((task) => task.status === "open")
      .filter((task) => input.type === undefined || task.type === input.type)
      .filter((task) => input.org === undefined || task.source.org === input.org)
      .filter((task) => input.sourceKind === undefined || task.source.kind === input.sourceKind)
      .filter((task) => input.language === undefined || task.language === input.language)
      // Orden estable y sin sorpresas: primero lo que lleva más tiempo esperando.
      .sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)))
      .slice(0, input.limit)
      .map(
        (task): TaskSummary => ({
          id: task.id,
          type: task.type,
          org: task.source.org,
          sourceKind: task.source.kind,
          title: task.title,
          estimatedMinutes: task.estimatedMinutes,
          language: task.language,
        }),
      );
    return { tasks, quota: await this.#quota() };
  }

  // -------------------------------------------------------------------------
  // get_task
  // -------------------------------------------------------------------------

  async getTask(input: GetTaskInput) {
    await this.#expireStaleClaims();
    const task = await this.#requireTask(input.taskId);
    const claim = await this.#store.getClaim(task.id);
    const yourClaim =
      claim !== undefined && claim.volunteerId === this.#session.volunteerId ? claim : null;
    return {
      task: {
        id: task.id,
        type: task.type,
        source: task.source,
        title: task.title,
        instructions: task.instructions,
        language: task.language,
        ...(task.type === "translate" ? { targetLanguage: task.targetLanguage } : {}),
        ...(task.type === "adapt" ? { standard: task.standard } : {}),
        ...(task.type === "classify" ? { question: task.question, labels: task.labels } : {}),
        ...(task.type === "patch"
          ? { preApproval: task.preApproval, reproduction: task.reproduction }
          : {}),
        ...(task.source.kind === "oss" ? { disclosure: disclosureFor(task) } : {}),
        checklist: task.checklist,
        estimatedMinutes: task.estimatedMinutes,
        status: task.status,
        // Invariante 5: el contenido NUNCA sale en crudo.
        untrustedContent: wrapUntrusted(task.content),
      },
      yourClaim,
    };
  }

  // -------------------------------------------------------------------------
  // claim_task
  // -------------------------------------------------------------------------

  async claimTask(input: ClaimTaskInput): Promise<{
    claim: Claim;
    quota: Quota;
    alreadyYours: boolean;
  }> {
    await this.#expireStaleClaims();
    const now = this.#now();

    // Invariantes 1 y 3, en UNA sola operación del store. Antes esto era comprobar-aquí y
    // guardar-después con cuatro `await` en medio, y seis `claim_task` simultáneos se llevaban seis
    // tareas con un límite de tres. Ver la cabecera de `store/task-store.ts`.
    const result = await this.#store.tryClaim({
      taskId: input.taskId,
      volunteerId: this.#session.volunteerId,
      sessionId: this.#session.sessionId,
      claimedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + LIMITS.claimTtlMs).toISOString(),
      maxClaimsPerSession: LIMITS.maxClaimsPerSession,
      maxClaimsPerDay: LIMITS.maxClaimsPerDay,
      maxPatchClaimsPerSession: LIMITS.maxPatchClaimsPerSession,
      dayStartIso: startOfUtcDay(now),
    });

    switch (result.outcome) {
      case "claimed":
        return { claim: result.claim, quota: await this.#quota(), alreadyYours: false };
      case "already_yours":
        return { claim: result.claim, quota: await this.#quota(), alreadyYours: true };
      case "claimed_by_other":
        throw new RelevoError(
          "claimed_by_other",
          `La tarea ${input.taskId} ya está reclamada por otro voluntario hasta ${result.claim.expiresAt}.`,
        );
      case "task_not_found":
        throw new RelevoError("task_not_found", `No existe la tarea ${input.taskId}.`);
      case "task_not_available":
        throw new RelevoError(
          "task_not_available",
          `La tarea ${input.taskId} está en estado "${result.status}" y no se puede reclamar.`,
        );
      case "session_quota_exceeded":
        throw new RelevoError(
          "session_quota_exceeded",
          `Límite de ${LIMITS.maxClaimsPerSession} tareas por sesión alcanzado. Abre una sesión nueva otro rato: el límite existe para que tu uso siga siendo personal y ordinario.`,
        );
      case "daily_quota_exceeded":
        throw new RelevoError(
          "daily_quota_exceeded",
          `Límite de ${LIMITS.maxClaimsPerDay} tareas al día alcanzado. Vuelve mañana.`,
        );
      case "patch_quota_exceeded":
        throw new RelevoError(
          "patch_quota_exceeded",
          `Ya has reclamado un parche en esta sesión, y el límite es ${LIMITS.maxPatchClaimsPerSession}. Revisar un parche le cuesta a un mantenedor mucho más que leer una traducción: el tope existe para que tu ayuda no sea trabajo extra para él. Puedes seguir con tareas de otro tipo.`,
        );
    }
  }

  // -------------------------------------------------------------------------
  // release_task
  // -------------------------------------------------------------------------

  async releaseTask(input: ReleaseTaskInput) {
    const expired = await this.#expireStaleClaims();
    const result = await this.#store.tryRelease(input.taskId, this.#session.volunteerId);
    if (result.outcome !== "released") {
      throw this.#claimError(result.outcome, input.taskId, expired);
    }
    return { taskId: input.taskId, status: "open" as const, quota: await this.#quota() };
  }

  // -------------------------------------------------------------------------
  // submit_result
  // -------------------------------------------------------------------------

  async submitResult(input: SubmitResultInput): Promise<{ submission: Submission; quota: Quota }> {
    const expired = await this.#expireStaleClaims();
    const task = await this.#requireTask(input.taskId);

    // La validación del resultado va ANTES y es pura: el tipo y las etiquetas de una tarea no cambian,
    // así que leerlos fuera de la operación atómica no abre ninguna ventana.
    if (input.result.type !== task.type) {
      throw new RelevoError(
        "result_type_mismatch",
        `La tarea ${task.id} es de tipo "${task.type}" y el resultado es de tipo "${input.result.type}".`,
      );
    }
    // El conjunto de etiquetas es CERRADO: sin esto, la precisión contra el gold set mide cualquier cosa.
    if (task.type === "classify" && input.result.type === "classify") {
      if (!task.labels.includes(input.result.label)) {
        throw new RelevoError(
          "label_not_allowed",
          `"${input.result.label}" no está entre las etiquetas admitidas: ${task.labels.join(", ")}.`,
        );
      }
    }

    // Comprobar el claim y registrar el envío, en una sola operación: dos `submit_result` simultáneos
    // registraban dos envíos de la misma tarea.
    const result = await this.#store.trySubmit({
      taskId: task.id,
      volunteerId: this.#session.volunteerId,
      sessionId: this.#session.sessionId,
      submittedAt: this.#now().toISOString(),
      result: input.result,
    });
    if (result.outcome !== "submitted") {
      throw this.#claimError(result.outcome, task.id, expired);
    }
    return { submission: result.submission, quota: await this.#quota() };
  }

  // -------------------------------------------------------------------------
  // Ayudas
  // -------------------------------------------------------------------------

  async #requireTask(taskId: string): Promise<Task> {
    const task = await this.#store.getTask(taskId);
    if (task === undefined) {
      throw new RelevoError("task_not_found", `No existe la tarea ${taskId}.`);
    }
    return task;
  }

  /**
   * Traduce el motivo por el que el store rechazó una operación sobre un claim.
   *
   * Distingue `claim_expired` de `no_claim` porque desde fuera se sienten igual y no lo son: a quien
   * acaba de perder media hora de trabajo por el TTL hay que decírselo con esas palabras.
   */
  #claimError(
    outcome: "no_claim" | "claimed_by_other",
    taskId: string,
    expired: ReadonlySet<string>,
  ): RelevoError {
    if (outcome === "claimed_by_other") {
      return new RelevoError("claimed_by_other", `La tarea ${taskId} está reclamada por otro voluntario.`);
    }
    if (expired.has(taskId)) {
      return new RelevoError(
        "claim_expired",
        `Tu claim sobre ${taskId} caducó (${LIMITS.claimTtlMs / 60000} minutos) y la tarea volvió a la cola. Reclámala otra vez y vuelve a enviar: no has perdido el texto, sólo la reserva.`,
      );
    }
    return new RelevoError("no_claim", `No tienes reclamada la tarea ${taskId}.`);
  }
}
