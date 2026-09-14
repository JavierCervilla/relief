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

import { createRelevoServer } from "../src/server/mcp.js";
import { harness } from "./helpers.js";

const TOOLS = ["list_tasks", "get_task", "claim_task", "release_task", "submit_result"];

let client: Client;

beforeEach(async () => {
  const h = await harness();
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

  it("las tools de lectura se anuncian como tales", async () => {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    expect(byName.get("list_tasks")?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get("get_task")?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get("claim_task")?.annotations?.readOnlyHint).not.toBe(true);
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

  it("cada respuesta trae structuredContent que valida contra su outputSchema", async () => {
    // Si el structuredContent no validara, el propio SDK haría fallar la llamada.
    const list = await client.callTool({ name: "list_tasks", arguments: {} });
    expect(list.structuredContent).toBeDefined();
    const quota = (list.structuredContent as { quota: { maxClaimsPerSession: number } }).quota;
    expect(quota.maxClaimsPerSession).toBe(3);
  });
});
