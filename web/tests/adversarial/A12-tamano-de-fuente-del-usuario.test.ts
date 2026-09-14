/**
 * PASE ADVERSARIO · clase A12 (la promesa vs lo entregado) · RELE-3
 *
 * LA PROMESA: «Accesible». Y la página declara su audiencia en su propio texto —«documentos que nadie
 * adapta a **lectura fácil**»— y en los comentarios de su hoja de estilo: «esta va dirigida en parte a
 * gente de accesibilidad».
 *
 * LA ENTREGA: **la preferencia de tamaño de letra del navegador no llega a la página.** El ajuste
 * «Tamaño de fuente» de Chrome/Firefox/Safari —el mecanismo que una persona con baja visión configura
 * UNA vez y espera que valga para toda la web— no mueve ni un píxel de esta landing.
 *
 * MEDIDO, no deducido (Chromium 141 vía CDP `Page.setFontSizes`, 2026-09-14, dist de 2a0f8b8):
 *
 *   | preferencia del usuario | `html`  | cuerpo de texto | etiquetas mono |
 *   |-------------------------|---------|-----------------|----------------|
 *   | 16 px (por defecto)     | 16 px   | **16 px**       | **10 px**      |
 *   | 24 px                   | 24 px   | **16 px**       | **10 px**      |
 *   | 32 px                   | 32 px   | **16 px**       | **10 px**      |
 *
 * El control de la misma sesión demuestra que el mecanismo del navegador funciona y que lo que lo anula
 * es esta hoja: con la preferencia a 32 px, un `<p style="font-size:1rem">` mide 32 px y uno con
 * `font-size:16px` mide 16. La preferencia SÍ llega a `<html>` (la tabla lo enseña) y muere en
 * `body { font-size: 16px }`.
 *
 * POR QUÉ NO LO VIO NADIE: las 23 declaraciones de `font-size` de `landing.css` son absolutas —21 en
 * `px` y 2 en `clamp(px, vw, px)`, que es relativo al VIEWPORT, no al usuario—. No hay ni un `rem`. Y
 * `html { -webkit-text-size-adjust: 100% }` apaga además el font-boosting de Chrome en Android. La
 * suite mide contraste sobre tokens y cadenas sobre el HTML: ninguna de las 87 pruebas ejecuta un
 * navegador, así que ningún test de este repo puede observar un tamaño computado.
 *
 * ALCANCE HONESTO: **esto no es un incumplimiento formal de WCAG 1.4.4**, que se satisface con el zoom
 * de página (verificado: a 320 px y al 400 % la página refluye sin scroll horizontal). Es el
 * incumplimiento de la promesa de la página: quien ha configurado su navegador para leer cómodamente
 * tiene que volver a hacerlo, a mano, en cada visita. Y el suelo es peor que el cuerpo de texto: las
 * etiquetas mono de `.marcador__texto`, `.tope__etiqueta` y `.ficha__etiqueta` están clavadas a **10 px
 * en mayúsculas**, y son las que rotulan los topes y las filas de las dos fichas.
 *
 * Repro browser (evidencia del bundle): `qa-bundles/RELE-3-adv/tamano-de-fuente.mjs`.
 * Este test fija el invariante de forma determinista y sin navegador.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const HOJA = readFileSync(new URL("../../src/styles/landing.css", import.meta.url), "utf8");

/** Las declaraciones de `font-size` de la hoja, sin comentarios. */
function declaracionesDeTamano(): string[] {
  const limpia = HOJA.replace(/\/\*[\s\S]*?\*\//g, " ");
  return [...limpia.matchAll(/font-size:\s*([^;]+);/g)].map((m) => (m[1] ?? "").trim());
}

/** ¿Esta declaración escala con la preferencia del usuario? Sólo `rem`/`em` lo hacen. */
function escalaConElUsuario(valor: string): boolean {
  return /\d\s*r?em\b/.test(valor);
}

describe("A12 · la preferencia de tamaño de letra del usuario llega a la página", () => {
  it("el `body` no clava el tamaño base en un valor absoluto", () => {
    const limpia = HOJA.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ");
    const cuerpo = limpia.slice(limpia.indexOf("body {"), limpia.indexOf("}", limpia.indexOf("body {")));
    const m = /font-size:\s*([^;]+)/.exec(cuerpo);
    expect(
      m === null || escalaConElUsuario(m[1] ?? ""),
      `body declara \`font-size: ${m?.[1] ?? ""}\`: mata la preferencia del navegador para toda la página`,
    ).toBe(true);
  });

  it("ninguna declaración de tamaño es sorda a la preferencia del usuario", () => {
    const sordas = declaracionesDeTamano().filter((v) => !escalaConElUsuario(v));
    expect(
      sordas,
      `${sordas.length} de ${declaracionesDeTamano().length} declaraciones de font-size no escalan con el usuario`,
    ).toEqual([]);
  });

  it("las etiquetas mono no se sirven a un tamaño fijo de 10 px", () => {
    const diez = declaracionesDeTamano().filter((v) => v === "10px");
    expect(diez, "rótulos de topes, marcadores § y filas de ficha, en mayúsculas y no ampliables").toEqual([]);
  });
});
