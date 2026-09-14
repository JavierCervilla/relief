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
 * **Muta una COPIA, nunca el árbol de trabajo.** La primera versión escribía la mutación encima del
 * fuente de producción y lo restauraba después, con la limpieza antes de cada `process.exit`. Eso
 * cubre las salidas que el script controla y ninguna más: ni un SIGKILL, ni un timeout de CI, ni un
 * OOM. Y aunque no se caiga, la ventana existe — `seguridad` se encontró un build suyo con
 * `@import url("https://fonts.googleapis.com/...")` dentro del CSS publicado, persiguió la fuga, y
 * resultó ser la mutación M20 mientras la batería corría en el mismo árbol. Lo pilló al primer intento
 * sin buscarlo.
 *
 * Que la mutación más peligrosa de la batería sea justamente «reintroduce un origen de terceros en
 * producción» es lo que convierte eso de curiosidad en riesgo: la ventana es corta, pero lo que se
 * escapa por ella es exactamente el anti-objetivo que la página promete cumplir.
 *
 * Uso:  node scripts/mutate.mjs [--only M1,M9] [--self-test]
 * Sale 1 si alguna mutación sobrevive, y 2 si la suite ya estaba roja sin mutar.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mutations = JSON.parse(readFileSync(join(ROOT, "scripts/mutations.json"), "utf8"));

/**
 * Lo que hay que copiar para poder construir y testear. `node_modules` NO se copia: se enlaza, que
 * es lo que hace la copia barata (un megabyte largo frente a varios cientos).
 */
const A_COPIAR = [
  "src",
  "tests",
  "scripts",
  "public",
  "package.json",
  "tsconfig.json",
  "astro.config.mjs",
  "vitest.config.ts",
];

/** Monta la copia de trabajo y devuelve su ruta. */
function montarCopia() {
  const copia = mkdtempSync(join(tmpdir(), "relevo-web-mutate-"));
  for (const entrada of A_COPIAR) {
    cpSync(join(ROOT, entrada), join(copia, entrada), { recursive: true });
  }
  symlinkSync(join(ROOT, "node_modules"), join(copia, "node_modules"), "dir");
  return copia;
}

/** Construye y corre la suite DENTRO de la copia. Devuelve true si todo está verde. */
function verde(copia) {
  const build = spawnSync("npx", ["astro", "build"], { cwd: copia, encoding: "utf8" });
  if (build.status !== 0) return false;
  return spawnSync("npx", ["vitest", "run"], { cwd: copia, encoding: "utf8" }).status === 0;
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

const COPIA = montarCopia();
// Se borra pase lo que pase, incluida una señal: es un directorio temporal y nada de producción
// depende de él, así que aquí un `finally` incompleto no puede hacer daño — lo peor es dejar basura
// en /tmp, no una mutación en el repo.
const limpiar = () => rmSync(COPIA, { recursive: true, force: true });
process.on("exit", limpiar);
for (const senal of ["SIGINT", "SIGTERM"]) process.on(senal, () => process.exit(130));

if (!verde(COPIA)) {
  process.stderr.write(
    "la suite ya está ROJA sin mutar nada: una batería sobre un baseline roto cuenta cada mutación\n" +
      "como cazada y miente en la dirección cómoda. Arregla la suite antes.\n",
  );
  process.exit(2);
}

let sobreviven = 0;
for (const m of aCorrer) {
  const ruta = join(COPIA, m.file);
  const original = readFileSync(ruta, "utf8");
  if (!original.includes(m.from)) {
    process.stdout.write(`✗ ${m.id.padEnd(4)} PATRÓN AUSENTE — ${m.what}\n`);
    sobreviven += 1;
    continue;
  }
  writeFileSync(ruta, original.replace(m.from, m.to));
  const siguieVerde = verde(COPIA);
  writeFileSync(ruta, original);
  if (siguieVerde) {
    process.stdout.write(`✗ ${m.id.padEnd(4)} SOBREVIVE — ${m.what}\n`);
    sobreviven += 1;
  } else {
    process.stdout.write(`✓ ${m.id.padEnd(4)} cazada — ${m.what}\n`);
  }
}

process.stdout.write(
  `\n${aCorrer.length} mutaciones, ${sobreviven === 0 ? "todas cazadas" : `${sobreviven} SUPERVIVIENTE(S)`}.\n`,
);
process.exit(sobreviven === 0 ? 0 : 1);
