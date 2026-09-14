/**
 * PASE ADVERSARIO · clase A12 (la promesa vs lo entregado) · RELE-3
 *
 * LA PROMESA: «no hay ni una cifra de actividad: no existe ninguna que sea verdad». El oráculo que la
 * sostiene (`CIFRAS_DECLARADAS` en `tests/vetos.ts`) afirma de sí mismo, literalmente:
 *
 *     «Cada cifra que la página puede contener está declarada abajo con cuántas veces y por qué, así
 *      que una añadida es un token nuevo o una cuenta que no cuadra.»
 *
 * EL LÍMITE QUE EL FICHERO YA DECLARA: «también pasa un número escrito en letra ("una docena de
 * organizaciones")». Está escrito como un EJEMPLO HIPOTÉTICO de lo que un editor de copy *podría* colar.
 *
 * ESTO ES LA ESCALADA, y es lo que convierte un límite documentado en un hallazgo: **no es
 * hipotético**. La página publicada en 2a0f8b8 ya contiene tres afirmaciones cuantitativas escritas en
 * letra, en las dos rutas, y ninguna está declarada en ninguna parte:
 *
 *   1. «más de dos millones de pull requests» / «more than two million pull requests» — una MAGNITUD
 *      atribuida a un estudio externo, en el mismo párrafo cuyos otros tres números (294, 800, 67) sí
 *      se declararon uno a uno con su motivo. La frase «cada cifra que la página puede contener está
 *      declarada» es falsa en la propia frase que el oráculo creía tener cubierta.
 *   2. «diez pull requests en el tiempo que cuesta verificar uno» / «ten pull requests…» — la cita que
 *      cierra el argumento del §3.
 *   3. «Contesta una persona, normalmente en un par de días» / «usually within a couple of days» — y
 *      ésta no es una cifra del estudio: **es una cifra de actividad propia**, un compromiso de
 *      capacidad operativa publicado por un proyecto que dos párrafos antes dice que no tiene ni
 *      voluntarios ni piloto. Es exactamente la clase que la promesa 2 prohíbe, y es la única de las
 *      tres que afirma algo sobre Relevo en vez de sobre el mundo.
 *
 * O sea: la única afirmación con forma de métrica de actividad que la página publica hoy atraviesa el
 * oráculo por el agujero que el oráculo declaró como teórico. Un límite documentado que ya está siendo
 * usado en producción no es un límite: es una excepción sin declarar.
 *
 * QUÉ NO AFIRMA ESTE TEST: que las tres frases sean mentira. La 1 y la 2 pueden ser citas correctas del
 * estudio, y la 3 puede ser verdad. Afirma que el gate no las ve y que su cabecera dice que sí.
 *
 * Reproducido el 2026-09-14 sobre `dist/` de 2a0f8b8.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { magnitudesSinDeclarar } from "../vetos.js";

const DIST = new URL("../../dist/", import.meta.url).pathname;

const PAGINAS = [
  { codigo: "es", ruta: "index.html" },
  { codigo: "en", ruta: join("en", "index.html") },
] as const;

const html: Record<string, string> = {};

beforeAll(() => {
  for (const { codigo, ruta } of PAGINAS) {
    const completa = join(DIST, ruta);
    if (!existsSync(completa)) throw new Error(`falta ${ruta} en dist/. Corre \`npm run build\`.`);
    html[codigo] = readFileSync(completa, "utf8");
  }
});

/** El mismo `textoVisible` que usa `render.test.ts`: lo que de verdad lee una persona. */
function textoVisible(fuente: string): string {
  return fuente
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ");
}

describe("A12 · ninguna magnitud en letra sin declarar", () => {
  /*
   * CÓMO SE RESOLVIÓ.
   *
   * El hallazgo tenía dos mitades y se trataron distinto:
   *
   *  - «más de dos millones de pull requests» y «diez pull requests en el tiempo que cuesta verificar
   *    uno» son del estudio que se cita. Legítimas — pero la cabecera del oráculo afirmaba que CADA
   *    cifra estaba declarada, y éstas no lo estaban. Ahora hay `MAGNITUDES_DECLARADAS`, con el mismo
   *    mecanismo que los dígitos: frase entera y motivo.
   *  - «contesta una persona, normalmente en un par de días» NO era del estudio. Era un compromiso de
   *    capacidad de Relevo publicado dos párrafos después de «no hay voluntarios activos», que es la
   *    clase exacta que la promesa prohíbe. Se ha retirado del texto: ahora dice «somos pocos y no hay
   *    guardia: puede tardar», que es verdad y sigue siendo útil.
   *
   * Trinquete: si vuelve una magnitud en letra sin declarar, o reaparece el compromiso de plazo, rojo.
   */
  for (const { codigo } of PAGINAS) {
    it(`${codigo}: toda magnitud en letra está declarada con su motivo`, () => {
      expect(
        magnitudesSinDeclarar(textoVisible(html[codigo] ?? "")),
        "afirmaciones cuantitativas que el oráculo de dígitos no puede ver porque no llevan dígitos",
      ).toEqual([]);
    });
  }

  it("el compromiso de plazo no vuelve", () => {
    expect(textoVisible(html.es ?? "")).not.toContain("en un par de días");
    expect(textoVisible(html.en ?? "")).not.toContain("within a couple of days");
  });

  it("y las que SÍ quedan siguen siendo las del estudio, no de Relevo", () => {
    // El control que acota el hallazgo: las dos declaradas hablan del mundo, no de nosotros.
    expect(textoVisible(html.es ?? "")).toContain("más de dos millones de pull requests");
    expect(textoVisible(html.es ?? "")).toContain("No hay voluntarios activos");
  });

  it("sabe ponerse rojo: el ejemplo que el docstring usaba como hipotético", () => {
    expect(magnitudesSinDeclarar("Ya trabajamos con una docena de organizaciones.")).toEqual([
      "docena",
    ]);
  });
});
