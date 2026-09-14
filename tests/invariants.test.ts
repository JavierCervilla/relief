/**
 * Los cinco invariantes del Design Doc §3.3.
 *
 * Cada `it` nombra el invariante que protege. La regla de la casa es que un aserto sólo cuenta cuando se
 * le ha visto fallar rompiendo la implementación a propósito: el registro de qué se rompió para ver cada
 * uno en rojo está en el artefacto `verificacion_invariantes.md` de la trayectoria.
 */

import { describe, expect, it } from "vitest";

import { LIMITS } from "../src/schema/task.js";
import { RelevoError } from "../src/server/errors.js";
import { harness, syntheticTasks } from "./helpers.js";

/** Ejecuta `fn` y devuelve el código del `RelevoError` que lanza. Falla si no lanza o si lanza otra cosa. */
async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof RelevoError) return error.code;
    throw error;
  }
  throw new Error("se esperaba un RelevoError y no se lanzó ninguno");
}

describe("invariante 1 — un claim, un voluntario", () => {
  it("reclamar lo que ya tiene otro falla con claimed_by_other", async () => {
    const h = await harness();
    await h.as({ volunteerId: "ana" }).claimTask({ taskId: "kiva-0001" });
    expect(
      await codeOf(() => h.as({ volunteerId: "borja", sessionId: "s2" }).claimTask({ taskId: "kiva-0001" })),
    ).toBe("claimed_by_other");
  });

  it("reclamar lo tuyo otra vez es idempotente y NO consume cuota", async () => {
    const h = await harness();
    const first = await h.service.claimTask({ taskId: "kiva-0001" });
    const second = await h.service.claimTask({ taskId: "kiva-0001" });

    expect(first.alreadyYours).toBe(false);
    expect(second.alreadyYours).toBe(true);
    expect(second.claim.claimedAt).toBe(first.claim.claimedAt);
    expect(second.claim.expiresAt).toBe(first.claim.expiresAt);
    // La prueba de que no consume cuota: el contador no se mueve entre la primera y la segunda.
    expect(second.quota.claimsThisSession).toBe(1);
  });

  it("una tarea reclamada desaparece de la lista de disponibles", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "kiva-0001" });
    const { tasks } = await h.as({ volunteerId: "borja", sessionId: "s2" }).listTasks({ limit: 50 });
    expect(tasks.map((t) => t.id)).not.toContain("kiva-0001");
  });
});

describe("invariante 2 — el claim caduca a los 30 minutos", () => {
  it("pasado el TTL la tarea vuelve sola a la cola y otro puede cogerla", async () => {
    const h = await harness();
    await h.as({ volunteerId: "ana" }).claimTask({ taskId: "kiva-0001" });

    h.clock.advanceMinutes(LIMITS.claimTtlMs / 60_000 + 1);

    const borja = h.as({ volunteerId: "borja", sessionId: "s2" });
    const { tasks } = await borja.listTasks({ limit: 50 });
    expect(tasks.map((t) => t.id)).toContain("kiva-0001");

    const reclaimed = await borja.claimTask({ taskId: "kiva-0001" });
    expect(reclaimed.claim.volunteerId).toBe("borja");
  });

  it("en el instante EXACTO del TTL el claim ya ha caducado", async () => {
    // El borde que el test de al lado dice cubrir y no cubría: probaba TTL-1 y TTL+1, nunca TTL.
    // `expiresAt > now` significa que al llegar la hora exacta el claim ya no vale.
    const h = await harness();
    await h.as({ volunteerId: "ana" }).claimTask({ taskId: "kiva-0001" });

    h.clock.advanceMinutes(LIMITS.claimTtlMs / 60_000);

    const reclaimed = await h
      .as({ volunteerId: "borja", sessionId: "s2" })
      .claimTask({ taskId: "kiva-0001" });
    expect(reclaimed.claim.volunteerId).toBe("borja");
  });

  it("justo ANTES del TTL el claim sigue vivo (el borde no se regala)", async () => {
    const h = await harness();
    await h.as({ volunteerId: "ana" }).claimTask({ taskId: "kiva-0001" });

    h.clock.advanceMinutes(LIMITS.claimTtlMs / 60_000 - 1);

    expect(
      await codeOf(() => h.as({ volunteerId: "borja", sessionId: "s2" }).claimTask({ taskId: "kiva-0001" })),
    ).toBe("claimed_by_other");
  });

  it("enviar con el claim caducado dice claim_expired, no 'no tienes nada'", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "kiva-0001" });
    h.clock.advanceMinutes(LIMITS.claimTtlMs / 60_000 + 1);

    expect(
      await codeOf(() =>
        h.service.submitResult({
          taskId: "kiva-0001",
          result: { type: "translate", text: "Rosa is 41 years old..." },
          reviewedByHuman: true,
        }),
      ),
    ).toBe("claim_expired");
  });

  it("una tarea ya enviada NO vuelve a la cola porque caduque su claim", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "kiva-0001" });
    await h.service.submitResult({
      taskId: "kiva-0001",
      result: { type: "translate", text: "Rosa is 41 years old..." },
      reviewedByHuman: true,
    });

    h.clock.advanceMinutes(LIMITS.claimTtlMs / 60_000 + 1);

    const { tasks } = await h.as({ volunteerId: "borja", sessionId: "s2" }).listTasks({ limit: 50 });
    expect(tasks.map((t) => t.id)).not.toContain("kiva-0001");
    expect((await h.store.getTask("kiva-0001"))?.status).toBe("submitted");
  });

  it("la guarda de 'sólo reabro lo que está claimed' se cumple con un claim vivo sobre algo ya enviado", async () => {
    // Este estado NO se puede construir por la puerta de delante: enviar retira el claim en la misma
    // operación. Se siembra por debajo a propósito, porque la alternativa es dejar una guarda que
    // ningún test puede matar — y un aserto que no se ha visto fallar no cuenta. Lo encontró el
    // verificador probando que la rama era inalcanzable.
    const h = await harness();
    await h.service.claimTask({ taskId: "kiva-0001" });
    const task = await h.store.getTask("kiva-0001");
    if (task === undefined) throw new Error("fixture ausente");
    await h.store.saveTask({ ...task, status: "submitted" });

    h.clock.advanceMinutes(LIMITS.claimTtlMs / 60_000 + 1);
    await h.service.listTasks({ limit: 50 }); // dispara la caducidad

    // El claim caducado SÍ se retira...
    expect(await h.store.getClaim("kiva-0001")).toBeUndefined();
    // ...pero la tarea se queda como estaba: el trabajo ya estaba hecho.
    expect((await h.store.getTask("kiva-0001"))?.status).toBe("submitted");
  });
});

describe("invariante 3 — cuota de sesión y diaria, contada sobre CLAIMS", () => {
  it(`la cuarta tarea de la sesión se rechaza (límite ${LIMITS.maxClaimsPerSession})`, async () => {
    const h = await harness();
    for (const id of ["kiva-0001", "kiva-0002", "plena-0001"]) {
      await h.service.claimTask({ taskId: id });
    }
    expect(await codeOf(() => h.service.claimTask({ taskId: "plena-0002" }))).toBe(
      "session_quota_exceeded",
    );
  });

  it("liberar NO devuelve cuota: reclamar-liberar-reclamar no es una puerta trasera", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "kiva-0001" });
    await h.service.releaseTask({ taskId: "kiva-0001" });
    await h.service.claimTask({ taskId: "kiva-0002" });
    await h.service.claimTask({ taskId: "plena-0001" });

    const quota = (await h.service.listTasks({ limit: 1 })).quota;
    expect(quota.claimsThisSession).toBe(3);
    expect(await codeOf(() => h.service.claimTask({ taskId: "plena-0002" }))).toBe(
      "session_quota_exceeded",
    );
  });

  it("una sesión nueva renueva la cuota de sesión pero NO la diaria", async () => {
    const h = await harness();
    const ids = [
      "kiva-0001",
      "kiva-0002",
      "plena-0001",
      "plena-0002",
      "cochrane-0001",
      "cochrane-0002",
    ];
    // Tres sesiones de tres tareas: 9 claims, uno por debajo del límite diario de 10.
    let taken = 0;
    for (const session of ["s1", "s2", "s3"]) {
      const svc = h.as({ sessionId: session });
      for (let i = 0; i < LIMITS.maxClaimsPerSession; i++) {
        const id = ids[taken % ids.length];
        if (id === undefined) throw new Error("fixture insuficiente");
        // Liberar tras reclamar deja la tarea disponible para la vuelta siguiente; la cuota, no.
        await svc.claimTask({ taskId: id });
        await svc.releaseTask({ taskId: id });
        taken++;
      }
    }
    const s4 = h.as({ sessionId: "s4" });
    expect((await s4.listTasks({ limit: 1 })).quota.claimsToday).toBe(9);

    await s4.claimTask({ taskId: "kiva-0001" }); // el décimo, que sí entra
    expect(await codeOf(() => s4.claimTask({ taskId: "kiva-0002" }))).toBe("daily_quota_exceeded");
  });

  it("el límite diario es por voluntario, no global", async () => {
    const h = await harness();
    await h.as({ volunteerId: "ana" }).claimTask({ taskId: "kiva-0001" });
    const borja = h.as({ volunteerId: "borja", sessionId: "s2" });
    expect((await borja.listTasks({ limit: 1 })).quota.claimsToday).toBe(0);
  });

  it("cruzar medianoche UTC permite volver a reclamar: el corte manda sobre la DECISIÓN, no sólo sobre el contador", async () => {
    // El test de abajo comprueba el contador que se MUESTRA; éste comprueba el que DECIDE. Son dos
    // caminos distintos en el código y sólo uno estaba cubierto: borrar el corte de día del lado de la
    // decisión no rompía nada. Lo cazó ampliar la batería de mutaciones (M21).
    const h = await harness(syntheticTasks(24));
    let taken = 0;
    for (let session = 0; session < 4; session++) {
      for (let i = 0; i < LIMITS.maxClaimsPerSession; i++) {
        const id = `synth-${String(taken).padStart(3, "0")}`;
        if (taken < LIMITS.maxClaimsPerDay) {
          await h.as({ sessionId: `d1-${session}` }).claimTask({ taskId: id });
        }
        taken++;
      }
    }
    // Agotado el día: el siguiente intento se rechaza.
    expect(await codeOf(() => h.as({ sessionId: "d1-x" }).claimTask({ taskId: "synth-020" }))).toBe(
      "daily_quota_exceeded",
    );

    h.clock.set("2026-09-15T00:00:00.000Z");

    // Día nuevo, sesión nueva: vuelve a entrar.
    const again = await h.as({ sessionId: "d2-0" }).claimTask({ taskId: "synth-020" });
    expect(again.alreadyYours).toBe(false);
  });

  it("la cuota diaria se reinicia al cambiar el día UTC", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "kiva-0001" });
    expect((await h.service.listTasks({ limit: 1 })).quota.claimsToday).toBe(1);

    h.clock.set("2026-09-15T00:00:00.000Z");
    expect((await h.service.listTasks({ limit: 1 })).quota.claimsToday).toBe(0);
  });

  it("un rechazo por cuota NO deja la tarea tocada", async () => {
    const h = await harness();
    for (const id of ["kiva-0001", "kiva-0002", "plena-0001"]) {
      await h.service.claimTask({ taskId: id });
    }
    await codeOf(() => h.service.claimTask({ taskId: "plena-0002" }));

    expect((await h.store.getTask("plena-0002"))?.status).toBe("open");
    expect(await h.store.getClaim("plena-0002")).toBeUndefined();
  });
});

describe("invariante 4 — submit_result exige un claim vivo y tuyo", () => {
  it("enviar sin haber reclamado falla con no_claim", async () => {
    const h = await harness();
    expect(
      await codeOf(() =>
        h.service.submitResult({
          taskId: "kiva-0001",
          result: { type: "translate", text: "..." },
          reviewedByHuman: true,
        }),
      ),
    ).toBe("no_claim");
  });

  it("enviar sobre el claim de otro falla con claimed_by_other", async () => {
    const h = await harness();
    await h.as({ volunteerId: "ana" }).claimTask({ taskId: "kiva-0001" });
    expect(
      await codeOf(() =>
        h.as({ volunteerId: "borja", sessionId: "s2" }).submitResult({
          taskId: "kiva-0001",
          result: { type: "translate", text: "..." },
          reviewedByHuman: true,
        }),
      ),
    ).toBe("claimed_by_other");
  });

  it("el resultado tiene que ser del tipo de la tarea", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "kiva-0001" });
    expect(
      await codeOf(() =>
        h.service.submitResult({
          taskId: "kiva-0001",
          result: { type: "classify", label: "rct", rationale: "porque sí" },
          reviewedByHuman: true,
        }),
      ),
    ).toBe("result_type_mismatch");
  });

  it("en classify, una etiqueta fuera del conjunto cerrado se rechaza", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "cochrane-0001" });
    expect(
      await codeOf(() =>
        h.service.submitResult({
          taskId: "cochrane-0001",
          result: { type: "classify", label: "quizás", rationale: "no lo tengo claro" },
          reviewedByHuman: true,
        }),
      ),
    ).toBe("label_not_allowed");
  });

  it("un envío válido guarda la submission, marca la tarea y retira el claim", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "cochrane-0001" });
    const { submission } = await h.service.submitResult({
      taskId: "cochrane-0001",
      result: {
        type: "classify",
        label: "rct",
        rationale: "Dice 'allocated ... using a computer-generated sequence'.",
      },
      reviewedByHuman: true,
    });

    expect(submission.reviewedByHuman).toBe(true);
    expect(await h.store.listSubmissions()).toHaveLength(1);
    expect((await h.store.getTask("cochrane-0001"))?.status).toBe("submitted");
    expect(await h.store.getClaim("cochrane-0001")).toBeUndefined();
  });

  it("no se puede enviar dos veces la misma tarea", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "cochrane-0001" });
    const result = {
      type: "classify" as const,
      label: "rct",
      rationale: "Asignación aleatoria explícita.",
    };
    await h.service.submitResult({ taskId: "cochrane-0001", result, reviewedByHuman: true });
    expect(
      await codeOf(() => h.service.submitResult({ taskId: "cochrane-0001", result, reviewedByHuman: true })),
    ).toBe("no_claim");
  });
});

describe("invariante 5 — el contenido sale siempre delimitado", () => {
  it("get_task nunca devuelve el contenido en crudo", async () => {
    const h = await harness();
    const { task } = await h.service.getTask({ taskId: "plena-0001" });
    expect(task.untrustedContent).toContain("INICIO CONTENIDO NO CONFIABLE");
    expect(task.untrustedContent).toContain("FIN CONTENIDO NO CONFIABLE");
    expect(task.untrustedContent).toContain("MATERIAL A PROCESAR");
    // El material sigue estando entero: delimitar no es mutilar.
    expect(task.untrustedContent).toContain("padrón municipal");
  });
});

describe("list_tasks / get_task — lo que el voluntario ve antes de elegir", () => {
  it("filtra por tipo, organización e idioma", async () => {
    const h = await harness();
    expect((await h.service.listTasks({ org: "kiva", limit: 50 })).tasks).toHaveLength(2);
    expect((await h.service.listTasks({ language: "pt-BR", limit: 50 })).tasks.map((t) => t.id)).toEqual([
      "kiva-0002",
    ]);
    // `classify` ya no es sólo de Cochrane: el triaje de issues es del mismo tipo y de otra vía.
    expect((await h.service.listTasks({ type: "classify", limit: 50 })).tasks.map((t) => t.id)).toEqual([
      "cochrane-0001",
      "cochrane-0002",
      "oss-triage-0001",
    ]);
  });

  it("filtra por VÍA, que es lo que separa triar issues de cribar estudios clínicos", async () => {
    const h = await harness();
    const ngo = await h.service.listTasks({ sourceKind: "ngo", limit: 50 });
    const oss = await h.service.listTasks({ sourceKind: "oss", limit: 50 });

    expect(ngo.tasks.every((t) => t.sourceKind === "ngo")).toBe(true);
    expect(oss.tasks.every((t) => t.sourceKind === "oss")).toBe(true);
    expect(ngo.tasks.length + oss.tasks.length).toBe(
      (await h.service.listTasks({ limit: 50 })).tasks.length,
    );

    // Y el cruce vía+tipo, que es la consulta real: «quiero clasificar, pero para una ONG».
    const cribado = await h.service.listTasks({ sourceKind: "ngo", type: "classify", limit: 50 });
    expect(cribado.tasks.map((t) => t.id)).toEqual(["cochrane-0001", "cochrane-0002"]);
  });

  it("el resumen NO lleva el contenido de la tarea", async () => {
    const h = await harness();
    const { tasks } = await h.service.listTasks({ limit: 50 });
    for (const task of tasks) {
      expect(Object.keys(task)).not.toContain("content");
      expect(Object.keys(task)).not.toContain("untrustedContent");
    }
  });

  it("respeta el límite y ordena por antigüedad", async () => {
    const h = await harness();
    const { tasks } = await h.service.listTasks({ limit: 2 });
    expect(tasks.map((t) => t.id)).toEqual(["kiva-0001", "kiva-0002"]);
  });

  it("get_task de una tarea inexistente falla con task_not_found", async () => {
    const h = await harness();
    expect(await codeOf(() => h.service.getTask({ taskId: "no-existe" }))).toBe("task_not_found");
  });

  it("una tarea de OSS trae la frase de divulgación ya redactada; una de ONG no la necesita", async () => {
    // Los mantenedores piden que se avise de que hay IA detrás. Dársela escrita quita la única excusa
    // para no ponerla, y por eso la redacta el SERVIDOR y no la skill — una skill se edita.
    const h = await harness();

    const oss = await h.service.getTask({ taskId: "oss-astro-0001" });
    expect(oss.task.disclosure).toBeDefined();
    expect(oss.task.disclosure).toMatch(/IA generativa/);
    expect(oss.task.disclosure).toMatch(/revisado una persona/);

    // En la vía ONG el consentimiento es la relación con la organización, no un aviso en un PR público.
    const ngo = await h.service.getTask({ taskId: "kiva-0001" });
    expect(ngo.task.disclosure).toBeUndefined();
  });

  it("y la de un parche dice ADEMÁS que la issue estaba pre-aprobada", async () => {
    const h = await harness();
    const patch = await h.service.getTask({ taskId: "oss-patch-0001" });
    expect(patch.task.disclosure).toMatch(/abierta a ayuda de IA/);
    // Y entrega el nivel 2 y la reproducción, que es lo que el voluntario tiene que ver fallar.
    expect(patch.task.preApproval?.issueUrl).toMatch(/^https:\/\//);
    expect(patch.task.reproduction).toBeTruthy();
  });

  it("get_task te dice si la tarea es tuya y hasta cuándo", async () => {
    const h = await harness();
    expect((await h.service.getTask({ taskId: "kiva-0001" })).yourClaim).toBeNull();
    await h.service.claimTask({ taskId: "kiva-0001" });
    expect((await h.service.getTask({ taskId: "kiva-0001" })).yourClaim?.volunteerId).toBe("ana");
    // Y no le enseña a otro el claim ajeno como si fuera suyo.
    expect(
      (await h.as({ volunteerId: "borja", sessionId: "s2" }).getTask({ taskId: "kiva-0001" })).yourClaim,
    ).toBeNull();
  });
});

describe("release_task", () => {
  it("devuelve la tarea a la cola y otro puede cogerla", async () => {
    const h = await harness();
    await h.service.claimTask({ taskId: "kiva-0001" });
    await h.service.releaseTask({ taskId: "kiva-0001" });
    expect((await h.store.getTask("kiva-0001"))?.status).toBe("open");
    const borja = await h.as({ volunteerId: "borja", sessionId: "s2" }).claimTask({ taskId: "kiva-0001" });
    expect(borja.claim.volunteerId).toBe("borja");
  });

  it("no se puede liberar lo que no tienes", async () => {
    const h = await harness();
    await h.as({ volunteerId: "ana" }).claimTask({ taskId: "kiva-0001" });
    expect(
      await codeOf(() => h.as({ volunteerId: "borja", sessionId: "s2" }).releaseTask({ taskId: "kiva-0001" })),
    ).toBe("claimed_by_other");
  });
});
