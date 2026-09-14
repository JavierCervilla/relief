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
 */

import type { Claim, Submission, Task } from "../schema/task.js";

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
}

export interface TaskStore {
  listTasks(): Promise<Task[]>;
  getTask(taskId: string): Promise<Task | undefined>;
  saveTask(task: Task): Promise<void>;

  getClaim(taskId: string): Promise<Claim | undefined>;
  listClaims(): Promise<Claim[]>;
  saveClaim(claim: Claim): Promise<void>;
  deleteClaim(taskId: string): Promise<void>;

  appendClaimEvent(event: ClaimEvent): Promise<void>;
  countClaimsInSession(sessionId: string): Promise<number>;
  /** Claims de este voluntario a partir de `sinceIso` (inclusive). */
  countClaimsForVolunteerSince(volunteerId: string, sinceIso: string): Promise<number>;

  saveSubmission(submission: Submission): Promise<void>;
  listSubmissions(): Promise<Submission[]>;
}
