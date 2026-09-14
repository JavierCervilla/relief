#!/usr/bin/env node
/**
 * Batería de mutaciones: rompe la implementación a propósito y comprueba que los tests lo cazan.
 *
 * Existe porque una batería en verde no dice nada por sí sola. Un aserto que nunca se ha visto fallar
 * puede estar comprobando el aire, y el caso ya medido en este equipo es un test que pasaba con y sin el
 * parche. Cada mutación de `mutations.json` desactiva UN invariante; si los tests siguen verdes, ese
 * invariante no está protegido por nadie y el fallo es del test, no del código.
 *
 * Uso:  node scripts/mutate.mjs [--only M3,M7] [--self-test]
 * Sale con código 1 si alguna mutación sobrevive, y con 2 si la suite ya estaba roja sin mutar.
 *
 * `--self-test` comprueba que la guarda del baseline SABE ponerse roja. Existe porque esa guarda es el
 * arreglo de «el verificador contaba suite-en-rojo como mutación-cazada», y sin un test se puede borrar
 * sin que nada se entere — o sea, es exactamente la clase de fallo que ella misma arregla. El
 * precedente es `gate-lint --self-test`, en este mismo repo.
 */

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mutations = JSON.parse(readFileSync(join(ROOT, "scripts/mutations.json"), "utf8"));

if (process.argv.includes("--self-test")) {
  // Rompe un test a propósito en una copia del árbol y exige que el baseline lo cace con exit 2.
  const fixture = join(ROOT, "tests/__self-test-roto.test.ts");
  writeFileSync(
    fixture,
    'import { expect, it } from "vitest";\nit("roto a propósito", () => { expect(1).toBe(2); });\n',
  );
  // La limpieza va ANTES de cada `process.exit`, nunca en un `finally`: `process.exit` no ejecuta los
  // `finally`, así que el fixture roto se quedaba en el árbol y dejaba la suite en rojo. Lo encontró el
  // propio gate al correr `npm run mutate` justo después.
  const run = spawnSync("node", [join(ROOT, "scripts/mutate.mjs"), "--only=M1"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  rmSync(fixture, { force: true });
  if (run.status !== 2) {
    console.error(`self-test: con la suite rota esperaba exit 2 y salió ${run.status}`);
    process.exit(1);
  }
  console.log("self-test: con la suite rota, la batería se niega a correr (exit 2). Correcto.");
  process.exit(0);
}

const onlyFlag = process.argv.find((arg) => arg.startsWith("--only="));
const only = onlyFlag ? new Set(onlyFlag.slice("--only=".length).split(",")) : undefined;
const selected = only ? mutations.filter((m) => only.has(m.id)) : mutations;

if (selected.length === 0) {
  console.error("ninguna mutación seleccionada");
  process.exit(2);
}

// La suite tiene que estar VERDE antes de empezar. Si no, cada mutación se apunta como "cazada"
// porque la suite sale roja — por el fallo que ya había, no por la mutación. Pasó: M41 se reportó
// cazada con un test en rojo por otro motivo, y sobrevivía. Un verificador que no se verifica a sí
// mismo miente en la dirección cómoda.
{
  const baseline = spawnSync("npx", ["vitest", "run", "--silent"], { cwd: ROOT, encoding: "utf8" });
  if (baseline.status !== 0) {
    console.error("la suite ya está ROJA sin mutar: arréglala antes, o cada mutación saldrá 'cazada' por el fallo que ya hay");
    process.exit(2);
  }
}

const survivors = [];

for (const mutation of selected) {
  const path = join(ROOT, mutation.file);
  const original = readFileSync(path, "utf8");

  if (!original.includes(mutation.from)) {
    // Una mutación que ya no se puede aplicar es una mutación que miente sobre lo que cubre.
    console.log(`✗ ${mutation.id}  el patrón ya no existe en ${mutation.file} — actualiza mutations.json`);
    survivors.push(mutation.id);
    continue;
  }

  writeFileSync(path, original.replace(mutation.from, mutation.to));
  try {
    const run = spawnSync("npx", ["vitest", "run", "--silent"], { cwd: ROOT, encoding: "utf8" });
    if (run.status === 0) {
      console.log(`✗ ${mutation.id}  SOBREVIVE — ${mutation.what}`);
      survivors.push(mutation.id);
    } else {
      console.log(`✓ ${mutation.id}  cazada — ${mutation.what}`);
    }
  } finally {
    writeFileSync(path, original);
  }
}

console.log(
  survivors.length === 0
    ? `\n${selected.length} mutaciones, todas cazadas.`
    : `\n${survivors.length} de ${selected.length} sobreviven: ${survivors.join(", ")}`,
);
process.exit(survivors.length === 0 ? 0 : 1);
