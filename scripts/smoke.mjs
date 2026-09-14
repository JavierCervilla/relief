#!/usr/bin/env node
/**
 * Smoke del binario construido: arranca `dist/index.js` por stdio y hace el saludo MCP de verdad.
 *
 * Existe por un fallo concreto: `dist/` compilaba, el typecheck pasaba, los 45 tests pasaban y el
 * servidor **no arrancaba** porque nadie copiaba las fixtures a `dist/`. Ningún test de `src/` puede
 * ver eso; sólo ejecutar lo que se publica.
 */

import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn("node", [join(ROOT, "dist/index.js")], { stdio: ["pipe", "pipe", "pipe"] });

const send = (msg) => child.stdin.write(`${JSON.stringify(msg)}\n`);
send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  },
});
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

let out = "";
let err = "";
child.stdout.on("data", (chunk) => {
  out += chunk;
});
child.stderr.on("data", (chunk) => {
  err += chunk;
});

const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);

const EXPECTED = ["list_tasks", "get_task", "claim_task", "release_task", "submit_result"];

child.on("close", () => {
  clearTimeout(timer);
  const missing = EXPECTED.filter((tool) => !out.includes(`"${tool}"`));
  if (missing.length > 0) {
    console.error(`smoke: el servidor no anunció ${missing.join(", ")}`);
    if (err.trim() !== "") console.error(`stderr: ${err.trim()}`);
    process.exit(1);
  }
  console.log(`smoke: el binario arranca y anuncia las ${EXPECTED.length} tools.`);
});

// Cerrar stdin termina el transporte stdio y con él el proceso.
setTimeout(() => child.stdin.end(), 1_500);
