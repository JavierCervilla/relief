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

/** Una fuente `oss` de mentira, con su opt-in, para las tareas sintéticas de la vía open source. */
export function ossSource(repo = "relevo-demo/docs-es") {
  return {
    kind: "oss" as const,
    org: repo.split("/")[0] ?? "relevo-demo",
    repo,
    optIn: {
      url: `https://github.com/${repo}/issues/12`,
      maintainer: "demo-maintainer",
      grantedAt: "2026-09-10T09:00:00.000Z",
    },
  };
}

/** Parches sintéticos: el tope es 1 por sesión, así que hacen falta varios para verlo morder. */
export function syntheticPatches(count: number): Task[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `patch-${String(i).padStart(3, "0")}`,
    type: "patch" as const,
    source: ossSource(),
    title: `Parche sintético ${i}`,
    instructions: "Cambio mínimo.",
    language: "en",
    content: `código ${i}`,
    checklist: [],
    estimatedMinutes: 20,
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
    preApproval: {
      issueUrl: `https://github.com/relevo-demo/docs-es/issues/${100 + i}`,
      maintainer: "demo-maintainer",
      approvedAt: "2026-09-12T10:00:00.000Z",
    },
    reproduction: "corre el binario y mira la salida",
    status: "open" as const,
  }));
}

/**
 * Tareas sintéticas, para los casos en que el juego del repo se queda corto.
 *
 * El límite diario es 10 y las fixtures son 6: sin esto, un test del techo diario pasa porque nunca
 * llega a rozarlo, que es la clase de aserto que no prueba nada.
 */
export function syntheticTasks(count: number): Task[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `synth-${String(i).padStart(3, "0")}`,
    type: "classify" as const,
    source: { kind: "ngo" as const, org: "synthetic", agreement: "fixture de test" },
    title: `Tarea sintética ${i}`,
    instructions: "Clasifica.",
    language: "en",
    question: "¿Sí o no?",
    labels: ["yes", "no"],
    content: `Material ${i}.`,
    checklist: [],
    estimatedMinutes: 1,
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
    status: "open" as const,
  }));
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
