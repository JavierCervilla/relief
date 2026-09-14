#!/usr/bin/env node
/**
 * Punto de entrada: servidor MCP de Relevo por stdio.
 *
 * Una sesión de Claude Code arranca su propio proceso, así que **un proceso es una sesión** y el límite
 * de 3 tareas por sesión sale gratis del ciclo de vida. Eso deja de ser cierto en cuanto haya un
 * servidor HTTP compartido, y por eso el identificador de sesión es explícito en el contrato en vez de
 * estar implícito en el proceso: cuando llegue la fase 2 sólo cambia quién lo rellena.
 *
 * El store es de memoria: al cerrar la sesión se pierden los claims. Es aceptable en el esqueleto y NO
 * lo es en cuanto haya una ONG de verdad esperando trabajo, lo cual está anotado en el ROADMAP como
 * bloqueante y no como "ya se verá".
 */

import { randomUUID } from "node:crypto";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadTasks } from "./fixtures/load.js";
import { createRelevoServer } from "./server/mcp.js";
import { RelevoService } from "./server/service.js";
import { MemoryTaskStore } from "./store/memory-store.js";

async function main(): Promise<void> {
  const tasks = await loadTasks();
  const store = new MemoryTaskStore(tasks);
  const service = new RelevoService(store, {
    volunteerId: process.env["RELEVO_VOLUNTEER_ID"] ?? "local-volunteer",
    sessionId: randomUUID(),
  });

  const server = createRelevoServer(service);
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  // stdout es el canal del protocolo: cualquier cosa que escribamos ahí rompe la conversación MCP.
  process.stderr.write(`relevo: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
