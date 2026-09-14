/**
 * El consentimiento, que en esta trayectoria es lo único que separa a Relevo de ser el problema.
 *
 * La comunidad open source lleva 2026 defendiéndose de lo que un estudio sobre 294 repos llama
 * «AI-DDoS»: contribuciones plausibles que desbordan la capacidad de revisión, con un 67 % de 800
 * mantenedores declarándolo carga significativa. Una cola de tareas que reparta trabajo sobre backlogs
 * ajenos sin permiso ES esa máquina.
 *
 * Por eso lo que se prueba aquí no es que el servidor rechace tareas sin consentimiento: es que una
 * tarea sin consentimiento **no se puede construir**. La diferencia importa — una comprobación se puede
 * borrar, un tipo no.
 */

import { describe, expect, it } from "vitest";

import {
  LIMITS,
  PatchResultSchema,
  RepoSchema,
  TaskSourceSchema,
  TaskSpecSchema,
  type TaskSpec,
} from "../src/schema/task.js";

/** Una tarea válida de cada vía, para mutarla en cada test y ver qué rechaza el esquema. */
const OSS_SOURCE = {
  kind: "oss" as const,
  org: "relevo-demo",
  repo: "relevo-demo/docs-es",
  optIn: {
    url: "https://github.com/relevo-demo/docs-es/issues/12",
    maintainer: "demo-maintainer",
    grantedAt: "2026-09-10T09:00:00.000Z",
  },
};

const PATCH: Record<string, unknown> = {
  id: "p1",
  type: "patch",
  source: OSS_SOURCE,
  title: "Arreglar algo",
  instructions: "Cambio mínimo.",
  language: "en",
  content: "código",
  checklist: [],
  estimatedMinutes: 20,
  createdAt: "2026-09-12T11:00:00.000Z",
  preApproval: {
    issueUrl: "https://github.com/relevo-demo/docs-es/issues/48",
    maintainer: "demo-maintainer",
    approvedAt: "2026-09-12T10:00:00.000Z",
  },
  reproduction: "npm ci && node bin/x.mjs; mira /tmp/x",
};

/** Quita una clave (anidada con `a.b`) y devuelve el objeto resultante. */
function without(obj: Record<string, unknown>, path: string): Record<string, unknown> {
  const copy = structuredClone(obj);
  const parts = path.split(".");
  const last = parts.pop();
  if (last === undefined) throw new Error("ruta vacía");
  let cursor: Record<string, unknown> = copy;
  for (const part of parts) cursor = cursor[part] as Record<string, unknown>;
  delete cursor[last];
  return copy;
}

describe("nivel 1 — sin procedencia no hay tarea", () => {
  it("una tarea SIN `source` no parsea", () => {
    expect(TaskSpecSchema.safeParse(without(PATCH, "source")).success).toBe(false);
  });

  it("una fuente `oss` sin opt-in no parsea", () => {
    expect(TaskSpecSchema.safeParse(without(PATCH, "source.optIn")).success).toBe(false);
  });

  it("una fuente `ngo` sin acuerdo nombrado no parsea", () => {
    const ngo = { kind: "ngo", org: "kiva" };
    expect(TaskSourceSchema.safeParse(ngo).success).toBe(false);
    expect(TaskSourceSchema.safeParse({ ...ngo, agreement: "carta 2026" }).success).toBe(true);
  });

  it("el opt-in exige una URL https: un consentimiento se comprueba mirándolo", () => {
    for (const url of ["no-es-una-url", "http://github.com/x/y/issues/1", "ftp://x/y"]) {
      const bad = structuredClone(PATCH);
      (bad["source"] as typeof OSS_SOURCE).optIn.url = url;
      expect(TaskSpecSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("el repo tiene forma `owner/name`", () => {
    const bad = structuredClone(PATCH);
    (bad["source"] as typeof OSS_SOURCE).repo = "sin-barra";
    expect(TaskSpecSchema.safeParse(bad).success).toBe(false);
  });
});

describe("nivel 2 — un parche sin issue pre-aprobada es inexpresable", () => {
  it("un `patch` SIN `preApproval` no parsea", () => {
    expect(TaskSpecSchema.safeParse(without(PATCH, "preApproval")).success).toBe(false);
  });

  it("un `patch` con procedencia de ONG no parsea: el nivel 2 no existe fuera de un repo", () => {
    const bad = structuredClone(PATCH);
    bad["source"] = { kind: "ngo", org: "kiva", agreement: "carta 2026" };
    const result = TaskSpecSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("un `patch` sin reproducción no parsea: sin ella el voluntario no puede ver el fallo", () => {
    expect(TaskSpecSchema.safeParse(without(PATCH, "reproduction")).success).toBe(false);
  });

  it("el `patch` completo sí parsea (para que los rechazos de arriba signifiquen algo)", () => {
    const parsed = TaskSpecSchema.safeParse(PATCH);
    expect(parsed.success).toBe(true);
    expect((parsed.data as TaskSpec).type).toBe("patch");
  });
});

describe("el resultado de un parche exige lo que el mantenedor pide", () => {
  const OK = { type: "patch", diff: "--- a\n+++ b", rationale: "arregla X", testedHow: "corrí Y, vi Z" };

  it("sin `testedHow` no se puede enviar — es la queja número uno, no un extra", () => {
    const sinPrueba: Record<string, unknown> = { ...OK };
    delete sinPrueba["testedHow"];
    expect(PatchResultSchema.safeParse(sinPrueba).success).toBe(false);
  });

  it("`testedHow` vacío tampoco vale", () => {
    expect(PatchResultSchema.safeParse({ ...OK, testedHow: "   " }).success).toBe(false);
  });

  it("el resultado completo parsea", () => {
    expect(PatchResultSchema.safeParse(OK).success).toBe(true);
  });
});

describe("el tope de parches es más bajo que el de tareas", () => {
  it("uno por sesión, y menos que el tope general", () => {
    expect(LIMITS.maxPatchClaimsPerSession).toBe(1);
    expect(LIMITS.maxPatchClaimsPerSession).toBeLessThan(LIMITS.maxClaimsPerSession);
  });
});

describe("una URL de consentimiento no puede mentirle a quien la lee", () => {
  function conOptIn(url: string): unknown {
    const task = structuredClone(PATCH);
    (task["source"] as typeof OSS_SOURCE).optIn.url = url;
    return task;
  }

  it("rechaza userinfo: `https://github.com@evil.example/` se lee como GitHub y no lo es", () => {
    expect(TaskSpecSchema.safeParse(conOptIn("https://github.com@evil.example/issues/1")).success).toBe(
      false,
    );
  });

  it("rechaza credenciales embebidas", () => {
    expect(
      TaskSpecSchema.safeParse(conOptIn("https://user:token@evil.example/relevo-demo/docs-es/issues/1"))
        .success,
    ).toBe(false);
  });

  it("rechaza caracteres de control: los escapes ANSI reescriben el terminal de quien revisa", () => {
    const conEscape = `https://github.com/relevo-demo/docs-es/issues/1${String.fromCharCode(27)}[2J`;
    expect(TaskSpecSchema.safeParse(conOptIn(conEscape)).success).toBe(false);
  });

  it("exige que el opt-in viva EN el repo que dice autorizar", () => {
    // Presencia del consentimiento no es coherencia del consentimiento: sin esto, `repo:
    // "torvalds/linux"` con un opt-in alojado en otro sitio pasa, y esa es justo la comprobacion que un
    // humano no hace.
    expect(
      TaskSpecSchema.safeParse(conOptIn("https://github.com/otro/proyecto/issues/1")).success,
    ).toBe(false);
    expect(
      TaskSpecSchema.safeParse(conOptIn("https://github.com/relevo-demo/docs-es/issues/9")).success,
    ).toBe(true);
  });

  it("el repositorio no admite `..` ni segmentos que empiecen por guion", () => {
    // Se prueba `RepoSchema` SOLO, a propósito. A través de la tarea entera, el cruce opt-in↔repo
    // rechazaba estos valores primero y el test pasaba por un motivo distinto del que anuncia: lo
    // destapó la mutación M40 sobreviviendo con el test en verde.
    for (const repo of ["../..", "a/..", "-rf/--no-preserve", "./x", "a/-b"]) {
      expect(RepoSchema.safeParse(repo).success).toBe(false);
    }
    expect(RepoSchema.safeParse("relevo-demo/docs-es").success).toBe(true);
  });

  it("la issue pre-aprobada también tiene que vivir en el repo declarado", () => {
    // Si no, `disclosureFor` afirma que «el proyecto marcó la issue como abierta a ayuda de IA» sobre un
    // proyecto que el esquema no respalda. La divulgación no puede venir vacía, pero sí puede mentir.
    const bad = structuredClone(PATCH);
    (bad["preApproval"] as { issueUrl: string }).issueUrl = "https://github.com/otro/proyecto/issues/1";
    expect(TaskSpecSchema.safeParse(bad).success).toBe(false);
  });
});
