/**
 * La frontera de persistencia.
 *
 * Hoy sólo hay una implementación, en memoria (`memory-store.ts`), y eso es deliberado: los invariantes
 * que importan en esta fase —unicidad del claim, caducidad, cuota— se prueban en milisegundos y sin
 * contenedor. Cuando entre Postgres será **otra implementación de esta misma interfaz**, con los mismos
 * tests, y no un rediseño.
 *
 * De ahí que los métodos sean asíncronos aunque el store en memoria no lo necesite, y que las cuotas se
 * pidan como **conteos** en vez de como listas: `countClaimsInSession` es un `SELECT count(*)`, mientras
 * que "dame todos los eventos y cuéntalos tú" no sobrevive a una tabla de verdad.
 *
 * ── POR QUÉ `tryClaim` Y `trySubmit` SON OPERACIONES DEL STORE ──────────────────────────────────
 *
 * Antes el servicio comprobaba la cuota y luego guardaba el claim, con cuatro `await` en medio. El rol
 * `seguridad` lo reprodujo contra el binario publicado: seis `claim_task` simultáneos, seis concedidos
 * con un límite de tres, y el propio servidor informando "6/3 en esta sesión". La misma ventana rompía
 * la unicidad del claim (dos voluntarios, la misma tarea) y permitía envíos duplicados.
 *
 * Un agente que emite varias tool calls en un turno es el caso NORMAL. Un control que sólo se sostiene
 * si esperas la respuesta anterior no es un control, y no se arregla con un mutex en proceso: eso
 * vuelve a romperse en cuanto haya dos procesos contra la misma base de datos.
 *
 * Así que la decisión atómica es **de quien guarda el estado**. Cada implementación la garantiza con lo
 * que tiene: la de memoria no suspende entre la comprobación y la escritura; la de Postgres lo hará en
 * una transacción. El servicio ya no puede colarse por en medio porque ya no hay medio.
 *
 * **Lo que esta promesa NO cubre**: la pasada de caducidad (`RelevoService.#expireStaleClaims`), que
 * sigue siendo un bucle con `await` en el servicio. Hoy no es alcanzable —con el store en memoria
 * ninguna llamada cede de verdad—, pero la ventana está en el código y se abre en cuanto el borrado
 * tenga latencia real. Su sitio está nombrado en el ROADMAP, en la casilla de fase 2 que la mueve al
 * servidor: el commit que la haga real es el que tiene que meterla aquí dentro.
 */

import type { Claim, Result, Submission, Task, TaskStatus, TaskType } from "../schema/task.js";

/**
 * Un claim ocurrido. Es un registro **append-only** y separado de los claims vivos: liberar una tarea
 * borra el claim, pero no borra que la reclamaste. Si la cuota se calculara sobre los claims vivos,
 * reclamar-liberar-reclamar sería una forma de trabajar sin límite sin aparecer en ningún contador.
 */
export interface ClaimEvent {
  taskId: string;
  volunteerId: string;
  sessionId: string;
  at: string;
  /** El tipo importa para la cuota: un `patch` tiene su propio tope, más bajo. */
  taskType: TaskType;
}

/** Todo lo que hace falta para decidir un claim, para que el store no tenga que consultar nada fuera. */
export interface ClaimRequest {
  taskId: string;
  volunteerId: string;
  sessionId: string;
  claimedAt: string;
  expiresAt: string;
  maxClaimsPerSession: number;
  maxClaimsPerDay: number;
  /** Tope propio de parches por sesión. Ver `LIMITS.maxPatchClaimsPerSession`. */
  maxPatchClaimsPerSession: number;
  /** Medianoche UTC del día de `claimedAt`: el corte del contador diario. */
  dayStartIso: string;
}

export type ClaimResult =
  | { outcome: "claimed"; claim: Claim }
  | { outcome: "already_yours"; claim: Claim }
  | { outcome: "claimed_by_other"; claim: Claim }
  | { outcome: "task_not_found" }
  | { outcome: "task_not_available"; status: TaskStatus }
  | { outcome: "session_quota_exceeded" }
  | { outcome: "daily_quota_exceeded" }
  | { outcome: "patch_quota_exceeded" };

/** Lo que hace falta para registrar un envío. La validación del resultado ya la hizo el servicio. */
export interface SubmitRequest {
  taskId: string;
  volunteerId: string;
  submittedAt: string;
  result: Result;
  sessionId: string;
}

export type SubmitResult =
  | { outcome: "submitted"; submission: Submission }
  | { outcome: "no_claim" }
  | { outcome: "claimed_by_other" };

/** Igual que el claim: comprobar que la tarea es tuya y soltarla es una sola decisión. */
export type ReleaseResult =
  | { outcome: "released" }
  | { outcome: "no_claim" }
  | { outcome: "claimed_by_other" };

export interface TaskStore {
  listTasks(): Promise<Task[]>;
  getTask(taskId: string): Promise<Task | undefined>;
  saveTask(task: Task): Promise<void>;

  getClaim(taskId: string): Promise<Claim | undefined>;
  listClaims(): Promise<Claim[]>;
  deleteClaim(taskId: string): Promise<void>;

  /** Decide y aplica un claim en una sola operación. Ver la cabecera de este fichero. */
  tryClaim(request: ClaimRequest): Promise<ClaimResult>;
  /** Comprueba el claim y registra el envío en una sola operación. */
  trySubmit(request: SubmitRequest): Promise<SubmitResult>;
  /** Comprueba el claim y libera la tarea en una sola operación. */
  tryRelease(taskId: string, volunteerId: string): Promise<ReleaseResult>;

  countClaimsInSession(sessionId: string): Promise<number>;
  /** Claims de este voluntario a partir de `sinceIso` (inclusive). */
  countClaimsForVolunteerSince(volunteerId: string, sinceIso: string): Promise<number>;

  listSubmissions(): Promise<Submission[]>;
}
