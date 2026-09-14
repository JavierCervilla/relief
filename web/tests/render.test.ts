/**
 * Los tests que corren sobre el HTML CONSTRUIDO, que es lo único que lee una persona.
 *
 * Por qué no basta con `copy.test.ts`: entre el diccionario y la página hay una plantilla, y en la
 * trayectoria anterior de este proyecto el fallo bloqueante fue exactamente ese — se añadieron tres
 * campos a una salida y no se tocó el renderizador, así que el modelo los recibía y la persona no los
 * veía nunca. Un veto que sólo mira la fuente de datos no cubre esa clase de fallo.
 *
 * Requiere `astro build` antes. Lo encadena `npm run gate`.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { en } from "../src/i18n/en.js";
import { es } from "../src/i18n/es.js";
import { construirMailto } from "../src/i18n/index.js";

import { NOMBRES_VETADOS, NUMEROS_PERMITIDOS } from "./vetos.js";

const DIST = new URL("../dist/", import.meta.url).pathname;

const PAGINAS = [
  { codigo: "es", ruta: "index.html", copy: es, lang: "es" },
  { codigo: "en", ruta: join("en", "index.html"), copy: en, lang: "en" },
] as const;

const html: Record<string, string> = {};

beforeAll(() => {
  for (const { codigo, ruta } of PAGINAS) {
    const completa = join(DIST, ruta);
    if (!existsSync(completa)) {
      throw new Error(`falta ${ruta} en dist/. Corre \`npm run build\` antes de los tests.`);
    }
    html[codigo] = readFileSync(completa, "utf8");
  }
});

/** El texto que de verdad lee una persona: sin etiquetas, sin scripts y sin estilos. */
function textoVisible(fuente: string): string {
  return fuente
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ");
}

describe("ninguna organización real aparece en la página publicada", () => {
  for (const { codigo } of PAGINAS) {
    it(`${codigo}: el HTML entero está limpio de nombres vetados`, () => {
      // Sobre el HTML COMPLETO, no sobre el texto visible: un nombre escondido en un `alt`, en un
      // `title` o en un comentario también es una afirmación pública.
      const fuente = (html[codigo] ?? "").toLowerCase();
      for (const nombre of NOMBRES_VETADOS) {
        expect(fuente, `«${nombre}» aparece en la página ${codigo}`).not.toContain(
          nombre.toLowerCase(),
        );
      }
    });
  }
});

describe("no hay ni una cifra de actividad: no existe ninguna que sea verdad", () => {
  for (const { codigo } of PAGINAS) {
    it(`${codigo}: todo número visible está en la lista de permitidos, con su motivo`, () => {
      const numeros = [...new Set(textoVisible(html[codigo] ?? "").match(/\d+/g) ?? [])];
      const intrusos = numeros.filter((n) => !NUMEROS_PERMITIDOS.has(n));
      expect(
        intrusos,
        `números sin justificar en ${codigo}. Si son legítimos, añádelos a NUMEROS_PERMITIDOS con su motivo; si son una métrica de actividad, no hay ninguna que sea verdad todavía`,
      ).toEqual([]);
    });
  }

  it("el test sabe ponerse rojo ante un contador inventado", () => {
    const impostor = textoVisible("<p>Ya llevamos <strong>1240</strong> tareas completadas.</p>");
    const intrusos = (impostor.match(/\d+/g) ?? []).filter((n) => !NUMEROS_PERMITIDOS.has(n));
    expect(intrusos).toEqual(["1240"]);
  });
});

describe("los dos idiomas se declaran y se apuntan entre sí", () => {
  for (const { codigo, lang } of PAGINAS) {
    it(`${codigo}: declara lang="${lang}" y enlaza las dos alternativas`, () => {
      const fuente = html[codigo] ?? "";
      expect(fuente).toContain(`<html lang="${lang}"`);
      expect(fuente).toMatch(/hreflang="es"/);
      expect(fuente).toMatch(/hreflang="en"/);
      expect(fuente).toMatch(/hreflang="x-default"/);
    });
  }

  it("cada página ofrece un enlace al OTRO idioma, no a sí misma", () => {
    expect(html["es"] ?? "").toContain('href="/en/"');
    expect(html["en"] ?? "").toContain('href="/"');
  });
});

describe("los dos mailto llegan a la página, cada uno con lo suyo", () => {
  /**
   * Los `href` de `mailto:` de una página, DESESCAPADOS.
   *
   * Se compara el enlace que un navegador seguiría, no la cadena de bytes del atributo. La primera
   * versión aseveraba el byte a byte con el escapado de Astro 5, y al subir a Astro 7 —forzado por un
   * CVE crítico— se puso roja sin que la página hubiera cambiado: el renderizador había empezado a
   * escapar `'` como `&#39;`. Ese es exactamente el aserto que mide el MECANISMO en vez de la
   * PROPIEDAD, y este repo ya lo pagó una vez.
   */
  const mailtosDe = (codigo: string): string[] =>
    [...(html[codigo] ?? "").matchAll(/href="(mailto:[^"]+)"/g)].map(([, crudo]) =>
      (crudo ?? "")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n))),
    );

  for (const { codigo, copy } of PAGINAS) {
    it(`${codigo}: la vía ONG y la vía OSS llevan su propio asunto y cuerpo`, () => {
      const enLaPagina = mailtosDe(codigo);
      expect(enLaPagina).toHaveLength(2);
      for (const via of [copy.bifurcacion.ong, copy.bifurcacion.oss]) {
        expect(enLaPagina).toContain(construirMailto(via.correo));
      }
    });
  }

  it("ningún mailto de un idioma aparece en el otro", () => {
    // Este es el cruce que nadie ve: el enlace funciona, el correo se abre, y llega mal.
    const enEs = mailtosDe("es");
    const enEn = mailtosDe("en");
    for (const via of [en.bifurcacion.ong, en.bifurcacion.oss]) {
      expect(enEs).not.toContain(construirMailto(via.correo));
    }
    for (const via of [es.bifurcacion.ong, es.bifurcacion.oss]) {
      expect(enEn).not.toContain(construirMailto(via.correo));
    }
  });

  it("cada botón apunta a la ficha que dice, y cada ficha existe", () => {
    // `aria-controls` que señala a un id inexistente es peor que no ponerlo: un lector de pantalla
    // anuncia un control que no lleva a ninguna parte.
    for (const { codigo } of PAGINAS) {
      const fuente = html[codigo] ?? "";
      for (const [, id] of fuente.matchAll(/aria-controls="([^"]+)"/g)) {
        expect(fuente, `${codigo}: aria-controls apunta a ${id}, que no existe`).toContain(
          `id="${id}"`,
        );
      }
    }
  });
});

describe("el contenido está en el HTML aunque no haya JavaScript", () => {
  for (const { codigo, copy } of PAGINAS) {
    it(`${codigo}: las dos fichas se sirven completas, sin depender del script`, () => {
      // La bifurcación es mejora progresiva: sin JS las dos fichas se ven abiertas. Eso no es sólo
      // cortesía con quien bloquea scripts — es lo que hace que un lector de pantalla, un buscador y
      // estos mismos tests puedan leer la página sin ejecutar un navegador.
      const visible = textoVisible(html[codigo] ?? "");
      expect(visible).toContain(copy.bifurcacion.ong.titulo);
      expect(visible).toContain(copy.bifurcacion.oss.titulo);
      expect(visible).toContain(copy.queNoEs.puntos[0]?.titulo ?? "");
      expect(visible).toContain(copy.estado.titulo);
    });
  }
});

describe("la página no filtra a sus visitantes a ningún tercero", () => {
  /**
   * Hay que mirar el CSS EMITIDO, no sólo el HTML.
   *
   * La primera versión de este test aseveraba `/fonts/` contra el HTML y se puso roja: las fuentes se
   * referencian desde el CSS, no desde la página. El aserto estaba mirando el artefacto equivocado —
   * y, peor, el agujero que decía cerrar vive precisamente ahí: un `@import url(fonts.googleapis.com)`
   * dentro de una hoja de estilos no aparece en el HTML y habría pasado limpio.
   */
  const css = (): string => {
    const dir = join(DIST, "_astro");
    const hojas = readdirSync(dir).filter((f) => f.endsWith(".css"));
    expect(hojas.length, "esperaba al menos una hoja de estilos emitida").toBeGreaterThan(0);
    return hojas.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  };

  const origenesDe = (fuente: string): string[] =>
    [...new Set(fuente.match(/https?:\/\/[a-z0-9.-]+/gi) ?? [])].filter(
      (u) => !u.startsWith("https://github.com"),
    );

  for (const { codigo } of PAGINAS) {
    it(`${codigo}: el HTML no carga nada de un tercero`, () => {
      expect(origenesDe(html[codigo] ?? ""), `orígenes externos en ${codigo}`).toEqual([]);
    });
  }

  it("el CSS tampoco: las fuentes salen de nuestro propio origen", () => {
    const hoja = css();
    expect(origenesDe(hoja), "orígenes externos en el CSS emitido").toEqual([]);
    expect(hoja, "las @font-face tienen que apuntar a /fonts/").toContain("url(/fonts/");
  });

  it("las cinco fuentes declaradas existen de verdad en el sitio construido", () => {
    // Una @font-face que apunta a un fichero que no se ha copiado falla en silencio: el navegador usa
    // la pila de reserva y la página se ve «casi bien».
    const rutas = [...new Set(css().match(/url\(\/fonts\/[^)]+\)/g) ?? [])].map((u) =>
      u.slice("url(".length, -1),
    );
    expect(rutas.length).toBe(5);
    for (const ruta of rutas) {
      expect(existsSync(join(DIST, ruta)), `falta ${ruta} en dist/`).toBe(true);
    }
  });
});
