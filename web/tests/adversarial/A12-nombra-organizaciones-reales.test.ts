/**
 * PASE ADVERSARIO · clase A12 (la promesa vs lo entregado) · RELE-3
 *
 * LA PROMESA, escrita por la propia página, en el §2 y en las dos rutas:
 *
 *     «No nombra a nadie sin permiso. — Ninguna organización aparece en esta página hasta que lo ha
 *      autorizado por escrito. Empezando por el hecho de que, hoy, no hay ninguna.»
 *
 * LA ENTREGA: la página publicada nombra HOY, en texto visible, a dos organizaciones reales que no han
 * autorizado nada por escrito:
 *
 *   - **GitHub** — en el pie, tres líneas por debajo de esa frase, como texto de enlace y como dominio.
 *   - **Claude / Claude Code** (producto de **Anthropic**) — en la entradilla de portada, en la
 *     `meta description` que enseña un buscador, y en la intro del §1.
 *
 * POR QUÉ NO LO VIO NADIE: el veto de nombres de `tests/vetos.ts` es una **lista negra de cinco
 * cadenas** —las cinco ONG que son *fixtures* del repo del servidor—. Es un oráculo de reconocimiento:
 * sólo ve lo que ya está escrito en él. El oráculo de CIFRAS del mismo fichero es lo contrario, una
 * lista BLANCA: un número no declarado se pone rojo por ser nuevo. Las dos mitades del mismo fichero
 * defienden dos promesas simétricas con polaridades opuestas, y la de los nombres no puede ponerse roja
 * ante ningún nombre que nadie haya anticipado. Éste es el caso que demuestra que la diferencia importa:
 * no hace falta añadir nada a la página para violar la promesa — **ya está violada en `main`**.
 *
 * NO ES UN JUICIO SOBRE SI CITAR A GITHUB O A CLAUDE ES LEGÍTIMO. Probablemente lo sea: son la forja
 * donde vive el código y la herramienta que el voluntario usa, y omitirlas haría la página incomprensible.
 * Lo que este test afirma es que **la frase publicada es absoluta y la página no lo es**, y que una de
 * las dos cosas tiene que ceder. Cuál, lo decide el arquitecto: acotar la frase («ninguna organización
 * *colaboradora*…») o quitar los nombres. Aquí sólo se fija el hecho.
 *
 * Reproducido el 2026-09-14 sobre `dist/` de 2a0f8b8.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { en } from "../../src/i18n/en.js";
import { es } from "../../src/i18n/es.js";

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

/**
 * Organizaciones reales de tercero que la página nombra hoy y que NO están en `NOMBRES_VETADOS`.
 *
 * No pretende ser exhaustiva —una lista negra nunca lo es, que es justamente el hallazgo—. Es la
 * evidencia mínima de que la promesa es más ancha que su oráculo.
 */
const TERCEROS_NOMBRADOS: readonly { nombre: string; quien: string }[] = [
  { nombre: "GitHub", quien: "la forja, enlazada en el pie" },
  { nombre: "Claude", quien: "producto de Anthropic, citado como la herramienta del voluntario" },
];

/** La frase del §2 que declara a los terceros. Se lee del diccionario: duplicarla aquí la dejaría podrirse. */
const DIVULGACION: Record<string, string> = {
  es: es.queNoEs.puntos[3]?.cuerpo ?? "",
  en: en.queNoEs.puntos[3]?.cuerpo ?? "",
};

describe("A12 · la página nombra a terceros, y por eso lo dice", () => {
  /*
   * CÓMO SE RESOLVIÓ, porque no es lo que este fichero medía al escribirse.
   *
   * El hallazgo era real: el §2 afirmaba «Ninguna organización aparece en esta página hasta que lo ha
   * autorizado por escrito» y la página nombraba a GitHub y a Claude Code tres líneas más abajo. De las
   * dos partes, la que cedió fue **la frase**: quitar la forja y la herramienta haría la página
   * incomprensible —«lo haces en tu propia sesión de… ¿qué?»— mientras que decir «no nombro a nadie»
   * nombrándolos es exactamente la afirmación de más que este proyecto entero intenta no cometer.
   *
   * Así que la promesa pasa a ser la que la página puede sostener: ningún PARTICIPANTE sin permiso, y
   * los terceros que se nombran se nombran diciendo qué son y que no han autorizado nada.
   *
   * Este fichero se queda como trinquete de esa resolución: si alguien restaura la frase absoluta, o
   * nombra a un tercero sin divulgarlo, vuelve a ponerse rojo.
   */
  for (const { codigo } of PAGINAS) {
    it(`${codigo}: cada tercero nombrado aparece también en la divulgación`, () => {
      const fuente = (html[codigo] ?? "").toLowerCase();
      const divulgacion = (DIVULGACION[codigo] ?? "").toLowerCase();
      for (const { nombre, quien } of TERCEROS_NOMBRADOS) {
        if (!fuente.includes(nombre.toLowerCase())) continue;
        expect(
          divulgacion,
          `la página nombra a ${nombre} (${quien}) y la divulgación del §2 no lo menciona`,
        ).toContain(nombre.toLowerCase());
      }
    });

    it(`${codigo}: la frase absoluta NO vuelve`, () => {
      // La versión vieja prometía más de lo que la página podía cumplir. Si reaparece, el hallazgo
      // original vuelve con ella.
      expect(html[codigo] ?? "").not.toContain("Ninguna organización aparece en esta página");
      expect(html[codigo] ?? "").not.toContain("No organisation appears on this page");
    });
  }

  it("la divulgación está publicada de verdad, no sólo en este test", () => {
    // Es la mitad que fija QUÉ promesa se está midiendo. Sin esto, el test de arriba podría pasar
    // porque la divulgación no existe en ninguna parte.
    for (const { codigo } of PAGINAS) {
      expect(html[codigo] ?? "").toContain(DIVULGACION[codigo] ?? "\u0000");
    }
  });
});
