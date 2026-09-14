/**
 * Carga del juego de tareas.
 *
 * Las fixtures se **validan con el mismo contrato** que valida todo lo demás (`TaskSpecSchema`). Es
 * barato y cierra la puerta a la clase de bug más tonta de esta fase: un fixture que se desincroniza
 * del esquema y hace que los tests prueben una forma de tarea que el servidor ya no acepta.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { TaskSpecSchema, type Task } from "../schema/task.js";

const DEFAULT_FIXTURES = fileURLToPath(new URL("./tasks.json", import.meta.url));

/** Ruta del fichero de tareas: `RELEVO_FIXTURES` si está, y si no el juego que viene con el repo. */
export function fixturesPath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env["RELEVO_FIXTURES"];
  return configured !== undefined && configured.trim() !== "" ? configured : DEFAULT_FIXTURES;
}

/** Lee y valida el fichero. Toda tarea nace `open`: el estado es del store, no del fixture. */
export async function loadTasks(path: string = fixturesPath()): Promise<Task[]> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  const specs = z.array(TaskSpecSchema).parse(raw);
  return specs.map((spec): Task => ({ ...spec, status: "open" }));
}
