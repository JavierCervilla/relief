/**
 * Las fixtures se validan contra el contrato de verdad.
 *
 * Es el bug tonto de esta fase: un fixture que se desincroniza del esquema hace que toda la batería
 * pruebe una forma de tarea que el servidor ya no acepta, y todo sigue verde.
 */

import { describe, expect, it } from "vitest";

import { loadTasks } from "../src/fixtures/load.js";
import { TaskSpecSchema } from "../src/schema/task.js";

describe("fixtures", () => {
  it("las tareas que trae el repo son válidas y nacen abiertas", async () => {
    const tasks = await loadTasks();
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      const { status, ...spec } = task;
      expect(status).toBe("open");
      expect(TaskSpecSchema.safeParse(spec).success).toBe(true);
    }
  });

  it("hay fixtures de las TRES ONGs candidatas y de los TRES tipos de tarea", async () => {
    const tasks = await loadTasks();
    expect(new Set(tasks.map((t) => t.org))).toEqual(
      new Set(["kiva", "plena-inclusion", "cochrane-crowd"]),
    );
    expect(new Set(tasks.map((t) => t.type))).toEqual(new Set(["translate", "adapt", "classify"]));
  });

  it("los identificadores son únicos", async () => {
    const ids = (await loadTasks()).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda classify trae un conjunto cerrado de al menos dos etiquetas", async () => {
    for (const task of await loadTasks()) {
      if (task.type !== "classify") continue;
      expect(task.labels.length).toBeGreaterThanOrEqual(2);
      expect(new Set(task.labels).size).toBe(task.labels.length);
    }
  });
});
