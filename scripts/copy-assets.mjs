#!/usr/bin/env node
/**
 * `tsc` compila TypeScript; lo que no es TypeScript se queda atrás. Las fixtures se leen con `fs` en
 * tiempo de ejecución, así que sin este paso `dist/` compila, pasa el typecheck y **no arranca**.
 */

import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = [["src/fixtures/tasks.json", "dist/fixtures/tasks.json"]];

for (const [from, to] of ASSETS) {
  await mkdir(dirname(join(ROOT, to)), { recursive: true });
  await cp(join(ROOT, from), join(ROOT, to));
}
