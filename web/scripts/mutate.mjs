#!/usr/bin/env node
/**
 * Batería de mutaciones de la web. Gemela de la del servidor (`../scripts/mutate.mjs`), con una
 * diferencia que manda: aquí hay que **reconstruir** entre mutación y test, porque los vetos de
 * honestidad corren sobre el HTML de `dist/` y no sobre el código.
 *
 * Por qué existe: el paquete `web/` nació sin ella y el verificador rompió la implementación catorce
 * veces — **seis mutaciones sobrevivieron** con la suite en 54/54 verde, y dos violaban restricciones
 * que el plan marca como no negociables (una métrica inventada en la `meta description`, y el inglés
 * perdiendo la frase «no hay voluntarios activos, ni tareas completadas, ni ninguna organización a
 * bordo»). El repo ya había decidido que una suite verde sin mutantes no cuenta; el paquete nuevo no
 * heredaba esa decisión.
 *
 * Los casos que él encontró están aquí con su identificador original (M1, M3, M4, M6, M9, M13, M14).
 *
 * Uso:  node scripts/mutate.mjs [--only M1,M9] [--self-test]
 * Sale 1 si alguna mutación sobrevive, y 2 si la suite ya estaba roja sin mutar.
 */

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mutations = JSON.parse(readFileSync(join(ROOT, "scripts/mutations.json"), "utf8"));

/** Construye y corre la suite. Devuelve true si TODO está verde. */
function verde() {
  const build = spawnSync("npx", ["astro", "build"], { cwd: ROOT, encoding: "utf8" });
  if (build.status !== 0) return false;
  return spawnSync("npx", ["vitest", "run"], { cwd: ROOT, encoding: "utf8" }).status === 0;
}

if (process.argv.includes("--self-test")) {
  // Rompe un test a propósito y exige que la guarda del baseline lo cace con exit 2. Mismo motivo que
  // en el servidor: esa guarda arregla «contar suite-en-rojo como mutación-cazada», así que sin un
  // test que la ejercite se puede borrar sin que nada se entere.
  const fixture = join(ROOT, "tests/__self-test-roto.test.ts");
  writeFileSync(
    fixture,
    'import { expect, it } from "vitest";\nit("roto a propósito", () => { expect(1).toBe(2); });\n',
  );
  const run = spawnSync("node", [join(ROOT, "scripts/mutate.mjs"), "--only=M1"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  // La limpieza va ANTES de cada `process.exit`, nunca en un `finally`: `process.exit` no los ejecuta,
  // y el fixture roto se quedaría en el árbol dejando la suite en rojo para el siguiente.
  rmSync(fixture, { force: true });
  if (run.status !== 2) {
    process.stderr.write(`self-test: con la suite rota esperaba exit 2 y salió ${run.status}\n`);
    process.exit(1);
  }
  process.stdout.write("self-test: con la suite rota, la batería se niega a correr (exit 2). Correcto.\n");
  process.exit(0);
}

const soloArg = process.argv.find((a) => a.startsWith("--only"));
const solo = soloArg === undefined ? null : new Set(soloArg.replace(/^--only=?/, "").split(","));
const aCorrer = mutations.filter((m) => solo === null || solo.has(m.id));

if (!verde()) {
  process.stderr.write(
    "la suite ya está ROJA sin mutar nada: una batería sobre un baseline roto cuenta cada mutación\n" +
      "como cazada y miente en la dirección cómoda. Arregla la suite antes.\n",
  );
  process.exit(2);
}

let sobreviven = 0;
for (const m of aCorrer) {
  const ruta = join(ROOT, m.file);
  const original = readFileSync(ruta, "utf8");
  if (!original.includes(m.from)) {
    process.stdout.write(`✗ ${m.id.padEnd(4)} PATRÓN AUSENTE — ${m.what}\n`);
    sobreviven += 1;
    continue;
  }
  writeFileSync(ruta, original.replace(m.from, m.to));
  const siguieVerde = verde();
  writeFileSync(ruta, original);
  if (siguieVerde) {
    process.stdout.write(`✗ ${m.id.padEnd(4)} SOBREVIVE — ${m.what}\n`);
    sobreviven += 1;
  } else {
    process.stdout.write(`✓ ${m.id.padEnd(4)} cazada — ${m.what}\n`);
  }
}

// Deja `dist/` coherente con el árbol: si la última mutación lo dejó construido mutado, el siguiente
// que corra los tests sin construir mediría el HTML equivocado.
verde();

process.stdout.write(
  `\n${aCorrer.length} mutaciones, ${sobreviven === 0 ? "todas cazadas" : `${sobreviven} SUPERVIVIENTE(S)`}.\n`,
);
process.exit(sobreviven === 0 ? 0 : 1);
