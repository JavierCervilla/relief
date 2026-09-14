/**
 * Las cinco tools **por MCP de verdad**: cliente y servidor hablando por un par de transportes en
 * memoria.
 *
 * Los tests de `invariants.test.ts` prueban el servicio; éste prueba el cableado, que es donde viven
 * otros bugs: un `inputSchema` mal derivado, un `structuredContent` que no valida contra su
 * `outputSchema`, un error que sube como excepción en vez de volver como resultado. Nada de eso se ve
 * llamando a la clase directamente.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";

import { LIMITS } from "../src/schema/task.js";
import { createRelevoServer } from "../src/server/mcp.js";
import { harness, type Harness } from "./helpers.js";

const TOOLS = ["list_tasks", "get_task", "claim_task", "release_task", "submit_result"];

let client: Client;
/** El harness se guarda para poder mover el reloj: sin él, un test de caducidad no puede existir. */
let h: Harness;

beforeEach(async () => {
  h = await harness();
  const server = createRelevoServer(h.service);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
});

function textOf(result: unknown): string {
  const content = (result as { content: { type: string; text?: string }[] }).content;
  return content.map((part) => part.text ?? "").join("\n");
}

describe("superficie MCP", () => {
  it("expone exactamente las cinco tools, ni una más", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...TOOLS].sort());
  });

  it("NINGUNA tool se anuncia como sólo-lectura, porque ninguna lo es", async () => {
    // `list_tasks` y `get_task` devuelven a la cola los claims caducados: leen y escriben. Anunciarlas
    // como sólo-lectura le miente al cliente que cachee o paralelice. Lo cazó el verificador: el test
    // anterior aseguraba que la anotación estaba, no que fuera cierta.
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).not.toBe(true);
    }
  });

  it("y `get_task` ESCRIBE: una lectura pasada el TTL devuelve la tarea a la cola", async () => {
    // La primera versión de este test aseguraba "Estado: claimed" justo después de reclamar, o sea una
    // verdad que ya lo era antes de la acción que decía probar: quitar la caducidad de `getTask` lo
    // dejaba verde. Lo cazó el verificador. Ahora la única llamada entre el reloj y el aserto es la
    // lectura, así que el cambio de estado sólo puede venir de ella.
    await client.callTool({ name: "claim_task", arguments: { taskId: "kiva-0001" } });
    expect((await h.store.getTask("kiva-0001"))?.status).toBe("claimed");

    h.clock.advanceMinutes(LIMITS.claimTtlMs / 60_000 + 1);
    // El reloj solo no cambia nada: hasta que alguien mire, la tarea sigue reclamada en el store.
    expect((await h.store.getTask("kiva-0001"))?.status).toBe("claimed");

    await client.callTool({ name: "get_task", arguments: { taskId: "kiva-0001" } });

    expect((await h.store.getTask("kiva-0001"))?.status).toBe("open");
    expect(await h.store.getClaim("kiva-0001")).toBeUndefined();
  });

  it("las descripciones dicen que esto no se hace en bucle", async () => {
    const { tools } = await client.listTools();
    const claim = tools.find((tool) => tool.name === "claim_task");
    expect(claim?.description).toMatch(/no reclames|no encadenes/i);
  });

  it("el ciclo completo listar → ver → reclamar → enviar funciona de punta a punta", async () => {
    const list = await client.callTool({ name: "list_tasks", arguments: { type: "classify" } });
    expect(textOf(list)).toContain("cochrane-0001");

    const detail = await client.callTool({
      name: "get_task",
      arguments: { taskId: "cochrane-0001" },
    });
    // El contenido llega delimitado también por el cable, no sólo dentro del proceso.
    expect(textOf(detail)).toContain("INICIO CONTENIDO NO CONFIABLE");

    const claim = await client.callTool({ name: "claim_task", arguments: { taskId: "cochrane-0001" } });
    expect(textOf(claim)).toContain("reclamada");
    expect(claim.isError).toBeFalsy();

    const submit = await client.callTool({
      name: "submit_result",
      arguments: {
        taskId: "cochrane-0001",
        result: {
          type: "classify",
          label: "rct",
          rationale: "Asignación con secuencia generada por ordenador.",
        },
        reviewedByHuman: true,
      },
    });
    expect(submit.isError).toBeFalsy();
    expect(textOf(submit)).toContain("pendiente de revisión");
  });

  it("un fallo previsto vuelve como resultado con isError y su código, no como excepción", async () => {
    const result = await client.callTool({ name: "get_task", arguments: { taskId: "no-existe" } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("[task_not_found]");
  });

  it("la cuota de sesión se aplica también por el cable", async () => {
    for (const taskId of ["kiva-0001", "kiva-0002", "plena-0001"]) {
      const ok = await client.callTool({ name: "claim_task", arguments: { taskId } });
      expect(ok.isError).toBeFalsy();
    }
    const rejected = await client.callTool({ name: "claim_task", arguments: { taskId: "plena-0002" } });
    expect(rejected.isError).toBe(true);
    expect(textOf(rejected)).toContain("[session_quota_exceeded]");
  });

  it("submit_result rechaza la llamada si no se afirma la revisión humana", async () => {
    await client.callTool({ name: "claim_task", arguments: { taskId: "kiva-0001" } });
    const result = await client.callTool({
      name: "submit_result",
      arguments: {
        taskId: "kiva-0001",
        result: { type: "translate", text: "Rosa is 41." },
        reviewedByHuman: false,
      },
    });
    // La afirmación de revisión humana es `z.literal(true)`, así que la corta el propio esquema de
    // entrada antes de llegar al servicio: decir "no la he revisado" no es un caso a manejar, es una
    // llamada mal formada.
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("reviewedByHuman");
  });

  it("la línea de cuota que lee la persona incluye los parches", async () => {
    const text = textOf(await client.callTool({ name: "list_tasks", arguments: {} }));
    expect(text).toMatch(/parches 0\/1/);
  });

  it("cada respuesta trae structuredContent que valida contra su outputSchema", async () => {
    // Si el structuredContent no validara, el propio SDK haría fallar la llamada.
    const list = await client.callTool({ name: "list_tasks", arguments: {} });
    expect(list.structuredContent).toBeDefined();
    const quota = (list.structuredContent as { quota: { maxClaimsPerSession: number } }).quota;
    expect(quota.maxClaimsPerSession).toBe(3);
  });
});

describe("el render: la PERSONA tiene que leer lo que el modelo lee", () => {
  /**
   * Existe porque no existía. Se añadieron tres campos a la salida de `get_task` sin tocar el
   * renderizador, y el resultado invertía el diseño entero: el modelo recibía el comando a ejecutar y
   * la divulgación, y quien firma `reviewedByHuman: true` no veía ninguna de las dos cosas. Lo cazó
   * `seguridad`, y el motivo de que el gate no lo viera es el de siempre — los asertos estaban contra
   * la salida del SERVICIO, no contra el texto que alguien lee.
   */
  it("una tarea de OSS enseña su consentimiento en el texto, no sólo en el structuredContent", async () => {
    const text = textOf(
      await client.callTool({ name: "get_task", arguments: { taskId: "oss-astro-0001" } }),
    );
    expect(text).toContain("Consentimiento del proyecto:");
    expect(text).toContain("https://github.com/relevo-demo/docs-es/issues/12");
    expect(text).toContain("demo-maintainer");
  });

  it("un parche enseña la issue pre-aprobada, la reproducción DELIMITADA y quién la escribió", async () => {
    const text = textOf(
      await client.callTool({ name: "get_task", arguments: { taskId: "oss-patch-0001" } }),
    );
    expect(text).toContain("Issue pre-aprobada para ayuda de IA:");
    expect(text).toContain("/issues/48");
    expect(text).toContain("EJECÚTALA Y MIRA EL FALLO");
    expect(text).toContain("la escribió quien reportó el fallo, no el mantenedor");
    // Y va dentro de la valla, porque es material que alguien va a ejecutar.
    expect(text).toContain("INICIO CONTENIDO NO CONFIABLE");
    expect(text).toContain("npm ci");
  });

  it("la frase de divulgación se le enseña a la persona, que es quien la tiene que pegar", async () => {
    const text = textOf(
      await client.callTool({ name: "get_task", arguments: { taskId: "oss-astro-0001" } }),
    );
    expect(text).toContain("Pega esta frase tal cual");
    expect(text).toContain("IA generativa");
  });

  it("y una tarea de ONG no enseña nada de eso, porque no le aplica", async () => {
    const text = textOf(
      await client.callTool({ name: "get_task", arguments: { taskId: "kiva-0001" } }),
    );
    expect(text).not.toContain("Consentimiento del proyecto:");
    expect(text).not.toContain("Pega esta frase");
    expect(text).not.toContain("Issue pre-aprobada");
  });
});
