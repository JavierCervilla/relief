/**
 * Store en memoria. Es el que usa el esqueleto y el que usan los tests.
 *
 * Clona lo que entra y lo que sale. Sin eso, quien llame puede mutar una tarea guardada por la puerta de
 * atrás y los tests pasan por accidente en vez de por diseño — que es justo el fallo que un store en
 * memoria hace fácil y una base de datos hace imposible.
 */

import type { Claim, Submission, Task } from "../schema/task.js";
import type { ClaimEvent, TaskStore } from "./task-store.js";

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

  async saveClaim(claim: Claim): Promise<void> {
    this.#claims.set(claim.taskId, clone(claim));
  }

  async deleteClaim(taskId: string): Promise<void> {
    this.#claims.delete(taskId);
  }

  async appendClaimEvent(event: ClaimEvent): Promise<void> {
    this.#claimEvents.push(clone(event));
  }

  async countClaimsInSession(sessionId: string): Promise<number> {
    return this.#claimEvents.filter((event) => event.sessionId === sessionId).length;
  }

  async countClaimsForVolunteerSince(volunteerId: string, sinceIso: string): Promise<number> {
    return this.#claimEvents.filter(
      (event) => event.volunteerId === volunteerId && event.at >= sinceIso,
    ).length;
  }

  async saveSubmission(submission: Submission): Promise<void> {
    this.#submissions.push(clone(submission));
  }

  async listSubmissions(): Promise<Submission[]> {
    return this.#submissions.map(clone);
  }
}
