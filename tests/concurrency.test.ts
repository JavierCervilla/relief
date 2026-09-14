/**
 * Los invariantes bajo llamadas CONCURRENTES.
 *
 * Existe porque toda la batería anterior era secuencial y por eso decía que la cuota funcionaba: el
 * rol `seguridad` reprodujo seis `claim_task` simultáneos contra el binario publicado y los seis
 * pasaron, con el propio servidor informando de "6/3 en esta sesión". Un agente que emite varias tool
 * calls en un turno es el caso NORMAL, no el raro — y un control que sólo se sostiene si esperas la
 * respuesta anterior no es un control.
 *
 * La regla que se deriva: comprobar y escribir tienen que ser una sola operación del store, sin ningún
 * punto de suspensión en medio. Un `await` entre el `if` y el `save` es una ventana.
 */

import { describe, expect, it } from "vitest";

import { LIMITS } from "../src/schema/task.js";
import { RelevoError } from "../src/server/errors.js";
import { harness, syntheticPatches, syntheticTasks } from "./helpers.js";

const ALL_TASK_IDS = [
  "kiva-0001",
  "kiva-0002",
  "plena-0001",
  "plena-0002",
  "cochrane-0001",
  "cochrane-0002",
];

/** Cuenta cuántas de las promesas cumplieron, y con qué códigos fallaron el resto. */
function tally(results: PromiseSettledResult<unknown>[]): {
  granted: number;
  codes: string[];
} {
  const codes: string[] = [];
  let granted = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      granted++;
    } else if (result.reason instanceof RelevoError) {
      codes.push(result.reason.code);
    } else {
      throw result.reason;
    }
  }
  return { granted, codes };
}

describe("cuota bajo concurrencia", () => {
  it("seis claim_task a la vez conceden como mucho el límite de sesión", async () => {
    const h = await harness();
    const { granted, codes } = tally(
      await Promise.allSettled(ALL_TASK_IDS.map((taskId) => h.service.claimTask({ taskId }))),
    );

    expect(granted).toBe(LIMITS.maxClaimsPerSession);
    expect(codes).toHaveLength(ALL_TASK_IDS.length - LIMITS.maxClaimsPerSession);
    expect(new Set(codes)).toEqual(new Set(["session_quota_exceeded"]));
  });

  it("el contador que el servidor informa después NUNCA supera el límite", async () => {
    const h = await harness();
    await Promise.allSettled(ALL_TASK_IDS.map((taskId) => h.service.claimTask({ taskId })));

    const { quota } = await h.service.listTasks({ limit: 1 });
    expect(quota.claimsThisSession).toBeLessThanOrEqual(LIMITS.maxClaimsPerSession);
  });

  it("y sólo quedan reclamadas tantas tareas como claims se concedieron", async () => {
    const h = await harness();
    await Promise.allSettled(ALL_TASK_IDS.map((taskId) => h.service.claimTask({ taskId })));

    expect(await h.store.listClaims()).toHaveLength(LIMITS.maxClaimsPerSession);
    const claimed = (await h.store.listTasks()).filter((task) => task.status === "claimed");
    expect(claimed).toHaveLength(LIMITS.maxClaimsPerSession);
  });

  it("el límite diario tampoco se salta con sesiones concurrentes del mismo voluntario", async () => {
    // Seis sesiones del MISMO voluntario, tres tareas DISTINTAS cada una: 18 intentos contra un techo
    // diario de 10. Las tareas tienen que ser distintas porque re-reclamar lo tuyo es idempotente por
    // diseño y contaría como concedido sin serlo; y tienen que ser más de 10, que es justo lo que las
    // seis fixtures del repo no dan.
    const h = await harness(syntheticTasks(18));
    const sessions = ["s1", "s2", "s3", "s4", "s5", "s6"];
    const attempts = sessions.flatMap((sessionId, session) =>
      Array.from({ length: LIMITS.maxClaimsPerSession }, (_, i) =>
        h
          .as({ volunteerId: "ana", sessionId })
          .claimTask({ taskId: `synth-${String(session * LIMITS.maxClaimsPerSession + i).padStart(3, "0")}` }),
      ),
    );

    const { granted, codes } = tally(await Promise.allSettled(attempts));
    expect(granted).toBe(LIMITS.maxClaimsPerDay);
    expect(new Set(codes)).toEqual(new Set(["daily_quota_exceeded"]));
  });

  it("y el techo diario es POR VOLUNTARIO: otro empieza de cero aunque el primero lo haya agotado", async () => {
    const h = await harness(syntheticTasks(18));
    await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        h
          .as({ volunteerId: "ana", sessionId: `a${Math.floor(i / 3)}` })
          .claimTask({ taskId: `synth-${String(i).padStart(3, "0")}` }),
      ),
    );
    const borja = h.as({ volunteerId: "borja", sessionId: "b1" });
    expect((await borja.listTasks({ limit: 1 })).quota.claimsToday).toBe(0);
    await expect(borja.claimTask({ taskId: "synth-017" })).resolves.toBeDefined();
  });

  it("dos voluntarios pidiendo la MISMA tarea a la vez: sólo uno se la lleva", async () => {
    const h = await harness();
    const { granted, codes } = tally(
      await Promise.allSettled([
        h.as({ volunteerId: "ana", sessionId: "sa" }).claimTask({ taskId: "kiva-0001" }),
        h.as({ volunteerId: "borja", sessionId: "sb" }).claimTask({ taskId: "kiva-0001" }),
      ]),
    );
    expect(granted).toBe(1);
    expect(codes).toEqual(["claimed_by_other"]);
  });
});

describe("envío bajo concurrencia", () => {
  it("dos submit_result simultáneos sobre la misma tarea sólo registran uno", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "cochrane-0001" });
    const result = {
      type: "classify" as const,
      label: "rct",
      rationale: "Asignación aleatoria explícita.",
    };

    const { granted } = tally(
      await Promise.allSettled([
        h.service.submitResult({ taskId: "cochrane-0001", result, reviewedByHuman: true }),
        h.service.submitResult({ taskId: "cochrane-0001", result, reviewedByHuman: true }),
      ]),
    );

    expect(granted).toBe(1);
    expect(await h.store.listSubmissions()).toHaveLength(1);
  });
});

describe("el tope de parches aguanta también en paralelo", () => {
  it("dos claim_task de parche a la vez: sólo uno entra", async () => {
    const h = await harness(syntheticPatches(4));
    const { granted, codes } = tally(
      await Promise.allSettled([
        h.service.claimTask({ taskId: "patch-000" }),
        h.service.claimTask({ taskId: "patch-001" }),
      ]),
    );
    expect(granted).toBe(LIMITS.maxPatchClaimsPerSession);
    expect(codes).toEqual(["patch_quota_exceeded"]);
  });

  it("cuatro a la vez tampoco: el tope no se negocia con el paralelismo", async () => {
    const h = await harness(syntheticPatches(4));
    const { granted } = tally(
      await Promise.allSettled(
        ["patch-000", "patch-001", "patch-002", "patch-003"].map((taskId) =>
          h.service.claimTask({ taskId }),
        ),
      ),
    );
    expect(granted).toBe(LIMITS.maxPatchClaimsPerSession);
    expect(await h.store.listClaims()).toHaveLength(LIMITS.maxPatchClaimsPerSession);
  });

  it("liberar el parche NO devuelve el cupo: se cuentan claims, como en todo lo demás", async () => {
    const h = await harness(syntheticPatches(4));
    await h.service.claimTask({ taskId: "patch-000" });
    await h.service.releaseTask({ taskId: "patch-000" });
    await expect(h.service.claimTask({ taskId: "patch-001" })).rejects.toThrow(/patch_quota|parche/i);
  });

  it("pero una sesión nueva vuelve a tener su parche", async () => {
    const h = await harness(syntheticPatches(4));
    await h.as({ sessionId: "s1" }).claimTask({ taskId: "patch-000" });
    const otra = await h.as({ sessionId: "s2" }).claimTask({ taskId: "patch-001" });
    expect(otra.alreadyYours).toBe(false);
  });
});
