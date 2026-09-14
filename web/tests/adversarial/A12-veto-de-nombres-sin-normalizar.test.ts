/**
 * PASE ADVERSARIO · clase A12 (la promesa vs lo entregado) · RELE-3
 *
 * LA PROMESA: «no nombra a nadie sin permiso». El mecanismo que la sostiene es `NOMBRES_VETADOS` de
 * `tests/vetos.ts`, comprobado como **subcadena en minúsculas** sobre el HTML entero.
 *
 * LA TERCERA FAMILIA DE FALSOS NEGATIVOS —la que no está declarada en `vetos.ts`, que sólo declara la
 * semántica de las cifras y los dígitos en comentarios HTML—: **el veto compara grafías de display, no
 * formas legibles por máquina**. Y la forma en que de verdad se nombra a una organización en una web es
 * un ENLACE: su dominio, su handle o su slug. Ahí los separadores desaparecen.
 *
 * De los cinco nombres vetados, cuatro son una sola palabra y sobreviven a la transformación
 * (`kiva.org` contiene «kiva»). El único de DOS palabras —«Plena Inclusión», la ONG española, es decir
 * la audiencia exacta de la ruta `/`— es el único cuyo dominio, handle y slug **atraviesan el veto sin
 * tocarlo**. La lista se cuidó de incluir la variante sin tilde («Plena Inclusion»), lo que prueba que
 * la normalización se consideró: se normalizó el diacrítico y no el separador, que es el que se pierde
 * al escribir una URL.
 *
 * Este test comprueba la PROPIEDAD del veto, no la página: mide si el oráculo sabe cazar a una
 * organización que él mismo ha decidido vetar, escrita como se escribe un enlace.
 *
 * Reproducido el 2026-09-14 contra `tests/vetos.ts` de 2a0f8b8 — `dist/` estaba limpio de estas
 * cadenas, así que el hallazgo era la ceguera del gate y no una violación en producción. ARREGLADO
 * normalizando también el separador; la entrada duplicada «Plena Inclusion» sin tilde sobraba y se
 * quitó. Este fichero se queda como trinquete.
 */
import { describe, expect, it } from "vitest";

import { NOMBRES_VETADOS, normalizarNombre } from "../vetos.js";

/**
 * El veto tal y como lo aplican `render.test.ts` y `copy.test.ts`.
 *
 * ARREGLADO (RELE-3, tras este pase): antes era `subcadena en minúsculas` reimplementada AQUÍ, que es
 * lo que permitía al hallazgo existir. Ahora llama a `normalizarNombre` —la función real— para que
 * este recorrido quede como TRINQUETE: si alguien vuelve a comparar grafías de display, estos cuatro
 * casos se ponen rojos otra vez.
 */
function elVetoCaza(fuente: string): boolean {
  const normal = normalizarNombre(fuente);
  return NOMBRES_VETADOS.some((n) => normal.includes(normalizarNombre(n)));
}

/**
 * Cómo se nombra de verdad a una organización en una página web: enlazándola.
 *
 * Las cuatro son referencias inequívocas a una organización que la lista de vetos YA contiene.
 */
const COMO_SE_ESCRIBE_UN_ENLACE: readonly { texto: string; forma: string }[] = [
  { texto: 'Con la colaboración de <a href="https://www.plenainclusion.org">esta federación</a>.', forma: "dominio" },
  { texto: "Nos lo pidió @PlenaInclusion por mensaje directo.", forma: "handle" },
  { texto: "Ver el piloto en /casos/plena-inclusion/", forma: "slug" },
  { texto: "Trabajamos con Plena  Inclusión desde marzo.", forma: "doble espacio" },
];

describe("A12 · el veto de nombres caza a una organización vetada escrita como un enlace", () => {
  for (const { texto, forma } of COMO_SE_ESCRIBE_UN_ENLACE) {
    it(`caza la forma «${forma}»`, () => {
      expect(
        elVetoCaza(texto),
        `«${texto}» nombra a una organización de NOMBRES_VETADOS y el veto no la ve`,
      ).toBe(true);
    });
  }

  it("control: la misma organización con su grafía de display SÍ se caza", () => {
    // Sin esto el test de arriba podría estar rojo por un fallo mío al invocar el veto.
    expect(elVetoCaza("Trabajamos con Plena Inclusión desde marzo.")).toBe(true);
    expect(elVetoCaza("Un piloto con Kiva.")).toBe(true);
  });

  it("control: los nombres de UNA palabra sí sobreviven a la forma de enlace", () => {
    // Es lo que acota el hallazgo: no es que el veto no sepa mirar URLs, es que pierde el separador.
    expect(elVetoCaza('<a href="https://www.kiva.org">una ONG</a>')).toBe(true);
    expect(elVetoCaza("ver ghostty.org")).toBe(true);
  });
});
