/**
 * La dirección de contacto vive en UN sitio.
 *
 * Publicar un correo en una página pública es irreversible, así que el valor real lo pone una persona,
 * no el agente. Para que ese cambio siga costando una línea el día que toque, la cadena no puede
 * haberse colado en una plantilla, en un test o en el README.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CORREO_CONTACTO, CORREO_ES_MARCADOR } from "../src/config.js";

const RAIZ = new URL("..", import.meta.url).pathname;
const IGNORAR = new Set(["node_modules", "dist", ".astro", ".git", "public"]);

function ficheros(dir: string, salida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (IGNORAR.has(entrada)) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) ficheros(ruta, salida);
    else if (/\.(ts|astro|mjs|js|css|json|md)$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

describe("la dirección de contacto", () => {
  it("aparece en `src/config.ts` y en ningún otro fichero del código fuente", () => {
    const conLaCadena = ficheros(RAIZ)
      .filter((f) => readFileSync(f, "utf8").includes(CORREO_CONTACTO))
      .map((f) => f.slice(RAIZ.length));
    expect(conLaCadena).toEqual(["src/config.ts"]);
  });

  it("mientras sea un marcador, su dominio es uno RESERVADO para ejemplos", () => {
    // Se asevera la PROPIEDAD, no el literal: repetir la cadena aquí hacía fallar al test de arriba
    // —y con razón, se cazó a sí mismo—. Y la propiedad es la que importa: `.example` está reservado
    // por la RFC 2606 justo para esto, así que un marcador con ese dominio no puede mandarle correo a
    // nadie por accidente, cosa que `contacto@relevo.org` sí podría.
    if (!CORREO_ES_MARCADOR) return;
    expect(CORREO_CONTACTO).toMatch(/@[a-z0-9.-]+\.(example|invalid|test)$/);
  });

  it("el día que sea una dirección real, sigue siendo una dirección", () => {
    expect(CORREO_CONTACTO).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
  });
});
