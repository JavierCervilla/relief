import { loadTasks } from "../src/fixtures/load.js";
import { RelevoService, type SessionContext } from "../src/server/service.js";
import { MemoryTaskStore } from "../src/store/memory-store.js";
import type { Task } from "../src/schema/task.js";

/**
 * Reloj de mentira compartido por todos los servicios de un test.
 *
 * La caducidad del claim es un invariante temporal; un test que la comprobara esperando treinta minutos
 * de verdad no se correría nunca, y un invariante que no se corre no es un invariante.
 */
export class FakeClock {
  #at: Date;

  constructor(iso = "2026-09-14T10:00:00.000Z") {
    this.#at = new Date(iso);
  }

  now = (): Date => new Date(this.#at);

  advanceMinutes(minutes: number): void {
    this.#at = new Date(this.#at.getTime() + minutes * 60_000);
  }

  set(iso: string): void {
    this.#at = new Date(iso);
  }
}

export async function fixtureTasks(): Promise<Task[]> {
  return loadTasks();
}

export interface Harness {
  store: MemoryTaskStore;
  clock: FakeClock;
  /** Un servicio nuevo sobre el MISMO store: así se modelan dos sesiones o dos voluntarios distintos. */
  as(session: Partial<SessionContext>): RelevoService;
  service: RelevoService;
}

export async function harness(tasks?: Task[]): Promise<Harness> {
  const store = new MemoryTaskStore(tasks ?? (await fixtureTasks()));
  const clock = new FakeClock();
  const as = (session: Partial<SessionContext>): RelevoService =>
    new RelevoService(
      store,
      { volunteerId: session.volunteerId ?? "ana", sessionId: session.sessionId ?? "s1" },
      { now: clock.now },
    );
  return { store, clock, as, service: as({}) };
}
