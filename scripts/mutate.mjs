#!/usr/bin/env node
/**
 * Batería de mutaciones: rompe la implementación a propósito y comprueba que los tests lo cazan.
 *
 * Existe porque una batería en verde no dice nada por sí sola. Un aserto que nunca se ha visto fallar
 * puede estar comprobando el aire, y el caso ya medido en este equipo es un test que pasaba con y sin el
 * parche. Cada mutación de `mutations.json` desactiva UN invariante; si los tests siguen verdes, ese
 * invariante no está protegido por nadie y el fallo es del test, no del código.
 *
 * Uso:  node scripts/mutate.mjs [--only M3,M7]
 * Sale con código 1 si alguna mutación sobrevive.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mutations = JSON.parse(readFileSync(join(ROOT, "scripts/mutations.json"), "utf8"));

const onlyFlag = process.argv.find((arg) => arg.startsWith("--only="));
const only = onlyFlag ? new Set(onlyFlag.slice("--only=".length).split(",")) : undefined;
const selected = only ? mutations.filter((m) => only.has(m.id)) : mutations;

if (selected.length === 0) {
  console.error("ninguna mutación seleccionada");
  process.exit(2);
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
