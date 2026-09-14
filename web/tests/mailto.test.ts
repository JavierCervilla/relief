/**
 * Los dos `mailto:`, que son el formulario entero de esta web.
 *
 * El fallo silencioso natural de una web bilingüe con dos vías es **cruzarlos**: un asunto en inglés
 * con un cuerpo en castellano, o el cuerpo de la ONG bajo el botón del proyecto. No revienta nada, no
 * sale en ningún log, y lo descubre el mantenedor al que le llega el correo raro.
 */
import { describe, expect, it } from "vitest";

import { CORREO_CONTACTO } from "../src/config.js";
import { en } from "../src/i18n/en.js";
import { es } from "../src/i18n/es.js";
import { construirMailto } from "../src/i18n/index.js";
import type { Correo } from "../src/i18n/types.js";

/** Deshace el `mailto:` para comprobar contra el diccionario, no contra otra cadena construida igual. */
function desmontar(url: string): { direccion: string; asunto: string; cuerpo: string } {
  const m = /^mailto:([^?]+)\?subject=([^&]*)&body=(.*)$/.exec(url);
  if (m === null) throw new Error(`no parece un mailto: ${url}`);
  return {
    direccion: m[1] ?? "",
    asunto: decodeURIComponent(m[2] ?? ""),
    cuerpo: decodeURIComponent(m[3] ?? ""),
  };
}

const CASOS: readonly { nombre: string; correo: Correo }[] = [
  { nombre: "es/ong", correo: es.bifurcacion.ong.correo },
  { nombre: "es/oss", correo: es.bifurcacion.oss.correo },
  { nombre: "en/ong", correo: en.bifurcacion.ong.correo },
  { nombre: "en/oss", correo: en.bifurcacion.oss.correo },
];

describe("cada mailto lleva SU asunto y SU cuerpo", () => {
  for (const { nombre, correo } of CASOS) {
    it(`${nombre}: asunto y cuerpo salen del mismo bloque`, () => {
      const { direccion, asunto, cuerpo } = desmontar(construirMailto(correo));
      expect(direccion).toBe(CORREO_CONTACTO);
      expect(asunto).toBe(correo.asunto);
      expect(cuerpo).toBe(correo.cuerpo.join("\n"));
    });
  }

  it("los cuatro son distintos entre sí", () => {
    // Si dos coinciden, o se ha copiado y pegado una vía, o un idioma se quedó sin traducir.
    const urls = CASOS.map(({ correo }) => construirMailto(correo));
    expect(new Set(urls).size).toBe(CASOS.length);
  });

  it("cruzar vía o idioma produce un mailto DISTINTO, que es lo que hace detectable el cruce", () => {
    const correcto = construirMailto(es.bifurcacion.oss.correo);
    const cruceDeVia = construirMailto(es.bifurcacion.ong.correo);
    const cruceDeIdioma = construirMailto(en.bifurcacion.oss.correo);
    expect(correcto).not.toBe(cruceDeVia);
    expect(correcto).not.toBe(cruceDeIdioma);
  });
});

describe("la codificación no se come el cuerpo", () => {
  it("los saltos de línea sobreviven", () => {
    const { cuerpo } = desmontar(construirMailto(es.bifurcacion.ong.correo));
    expect(cuerpo.split("\n").length).toBe(es.bifurcacion.ong.correo.cuerpo.length);
  });

  it("un cuerpo con `&` y con tildes no trunca la URL", () => {
    // Sin `encodeURIComponent`, el cliente de correo corta el cuerpo en el primer `&` y se pierde la
    // mitad del formulario sin que nadie se entere.
    const trampa: Correo = { asunto: "A & B", cuerpo: ["¿Qué tal?", "x=1&y=2", "ñandú"] };
    const { asunto, cuerpo } = desmontar(construirMailto(trampa));
    expect(asunto).toBe("A & B");
    expect(cuerpo).toBe("¿Qué tal?\nx=1&y=2\nñandú");
  });
});
