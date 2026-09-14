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
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { CORREO_ES_MARCADOR } from "../src/config.js";
import { en } from "../src/i18n/en.js";
import { es } from "../src/i18n/es.js";
import { construirMailto } from "../src/i18n/index.js";

import { NOMBRES_VETADOS, cifrasIntrusas } from "./vetos.js";

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

/** Desescapa entidades HTML. Un atributo se compara por su VALOR, no por su codificación. */
function desescapar(fuente: string): string {
  return fuente
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

/**
 * Lo que la página PUBLICA fuera del texto visible.
 *
 * Existe porque `textoVisible()` borra la etiqueta entera —atributos incluidos— y ahí es donde el
 * verificador metió las tres cifras que sobrevivieron al gate: en `meta description` (lo que sale en
 * el buscador y en la tarjeta de cualquier red social), en un `aria-label` (lo que oye un lector de
 * pantalla) y en el cuerpo de un `mailto:` (que además viaja percent-encoded, así que ni casaba con
 * `\d`). Las tres son afirmaciones públicas; que no se vean en la página no las hace menos públicas.
 */
function atributosPublicados(fuente: string): string[] {
  const salida: string[] = [];
  // `meta` de contenido, NO las de máquina (`viewport`, `charset`): aquéllas llevan dígitos por
  // diseño y no afirman nada sobre el proyecto.
  for (const [meta] of fuente.matchAll(/<meta\b[^>]*>/g)) {
    const nombre = /(?:name|property)="([^"]*)"/.exec(meta)?.[1] ?? "";
    if (!/^(description|og:|twitter:)/.test(nombre)) continue;
    const contenido = /content="([^"]*)"/.exec(meta)?.[1];
    if (contenido !== undefined) salida.push(desescapar(contenido));
  }
  for (const atributo of ["title", "alt", "aria-label", "aria-description", "aria-placeholder"]) {
    for (const [, valor] of fuente.matchAll(new RegExp(`\\b${atributo}="([^"]*)"`, "g"))) {
      salida.push(desescapar(valor ?? ""));
    }
  }
  // El `<title>`, que no es un atributo pero se publica igual.
  const titulo = /<title>([^<]*)<\/title>/.exec(fuente)?.[1];
  if (titulo !== undefined) salida.push(desescapar(titulo));
  return salida;
}

/** El asunto y el cuerpo de cada `mailto:`, ya decodificados. */
function textosDeMailto(fuente: string): string[] {
  const salida: string[] = [];
  for (const [, href] of fuente.matchAll(/href="(mailto:[^"]+)"/g)) {
    const url = desescapar(href ?? "");
    for (const campo of ["subject", "body"]) {
      const crudo = new RegExp(`[?&]${campo}=([^&]*)`).exec(url)?.[1];
      if (crudo !== undefined) salida.push(decodeURIComponent(crudo));
    }
  }
  return salida;
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

    it(`${codigo}: tampoco escondido en un mailto, donde el espacio va percent-encoded`, () => {
      // Punto ciego gemelo del de arriba, señalado por el verificador: dentro de un `mailto:` los
      // nombres de dos palabras viajan como `Plena%20Inclusi%C3%B3n`, y un `toContain` sobre el HTML
      // crudo no los ve. Sólo los de una palabra sobreviven al encoding intactos.
      const textos = [...atributosPublicados(html[codigo] ?? ""), ...textosDeMailto(html[codigo] ?? "")]
        .join("\n")
        .toLowerCase();
      for (const nombre of NOMBRES_VETADOS) {
        expect(textos, `«${nombre}» viaja en un atributo o en un mailto de ${codigo}`).not.toContain(
          nombre.toLowerCase(),
        );
      }
    });
  }
});

describe("no hay ni una cifra de actividad: no existe ninguna que sea verdad", () => {
  /**
   * TRES poblaciones, porque una afirmación pública no deja de serlo por no estar en el cuerpo.
   *
   * La versión anterior miraba sólo el texto visible, y el verificador coló cifras por los otros dos
   * canales con la suite en 54/54 verde: `meta description` (lo que enseña un buscador) y `aria-label`
   * (lo que oye un lector de pantalla). Y una lista blanca de dígitos no habría bastado aunque hubiera
   * mirado los tres: admitía `0,1,2,3,4,5,10` en cualquier sitio, así que «10 organizaciones a bordo»
   * pasaba. Ahora el oráculo es por contexto (ver `vetos.ts`).
   */
  for (const { codigo, copy } of PAGINAS) {
    it(`${codigo} · texto visible: ningún dígito fuera de un contexto legítimo`, () => {
      const intrusas = cifrasIntrusas(textoVisible(html[codigo] ?? ""), copy);
      expect(
        intrusas,
        `cifras fuera de contexto en ${codigo}. Los únicos sitios donde un número es legítimo son los topes con su etiqueta, los párrafos del estudio, la licencia y los ordinales §. Si esto es una métrica de actividad, no hay ninguna que sea verdad todavía`,
      ).toEqual([]);
    });

    it(`${codigo} · atributos publicados: ni un dígito`, () => {
      // Aquí la regla es más dura y a propósito: ni el `<title>`, ni la `meta description`, ni ningún
      // `aria-label` de esta página tienen motivo para llevar un número. Cero, sin contextos.
      for (const texto of atributosPublicados(html[codigo] ?? "")) {
        expect(texto.match(/\d+/g) ?? [], `dígito en un atributo publicado de ${codigo}: «${texto}»`).toEqual(
          [],
        );
      }
    });

    it(`${codigo} · cuerpos de los mailto: ni un dígito`, () => {
      for (const texto of textosDeMailto(html[codigo] ?? "")) {
        expect(texto.match(/\d+/g) ?? [], `dígito en un mailto de ${codigo}: «${texto}»`).toEqual([]);
      }
    });
  }

  describe("y sabe ponerse rojo en LAS TRES poblaciones", () => {
    // Un caso por población. El de antes sólo ejercitaba el texto visible sobre un `<p>`, que era
    // justo la única ruta que ya funcionaba: el «sabe ponerse rojo» probaba lo que no hacía falta
    // probar.
    it("texto visible", () => {
      const impostor = textoVisible("<p>Ya llevamos <strong>1240</strong> tareas completadas.</p>");
      expect(cifrasIntrusas(impostor, es)).toEqual(["1240"]);
    });

    it("atributo publicado (meta description)", () => {
      const impostor = '<meta name="description" content="Ya hay 87 organizaciones a bordo.">';
      expect(atributosPublicados(impostor).join(" ").match(/\d+/g)).toEqual(["87"]);
    });

    it("cuerpo de un mailto", () => {
      const impostor = `<a href="mailto:x@y.example?subject=hola&#38;body=${encodeURIComponent("Somos 42 voluntarios")}">x</a>`;
      expect(textosDeMailto(impostor).join(" ").match(/\d+/g)).toEqual(["42"]);
    });

    it("un número que la lista blanca ANTERIOR habría dejado pasar", () => {
      // La mutación M6 del verificador, que pasaba con la versión vieja del oráculo.
      const impostor = textoVisible("<p>Ya hay 10 organizaciones a bordo y 3 voluntarios activos.</p>");
      expect(cifrasIntrusas(impostor, es).sort()).toEqual(["10", "3"]);
    });
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

describe("la página FUNCIONA sin JavaScript, no sólo contiene el texto", () => {
  /**
   * Los dos asertos de abajo existen porque el de «el contenido está en el HTML» medía otra cosa: que
   * la cadena estuviera en el fichero. El verificador rompió la mejora progresiva dos veces sin que se
   * pusiera rojo — sirviendo las fichas ya con `hidden`, y borrando la regla que esconde los botones
   * sin JS. En los dos casos el texto seguía en el HTML y el test seguía verde, mientras la página
   * quedaba con las fichas invisibles o con dos botones muertos.
   */
  const css = (): string => {
    const dir = join(DIST, "_astro");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
  };

  for (const { codigo } of PAGINAS) {
    it(`${codigo}: ninguna ficha se sirve ya plegada`, () => {
      // `hidden` lo pone el script al arrancar. Si viene del servidor, quien no ejecute JavaScript no
      // ve NINGUNA de las dos vías.
      const fichas = [...(html[codigo] ?? "").matchAll(/<div class="ficha"[^>]*>/g)].map(([f]) => f);
      expect(fichas).toHaveLength(2);
      for (const ficha of fichas) {
        expect(ficha, `una ficha de ${codigo} llega con hidden desde el servidor`).not.toMatch(
          /\bhidden\b/,
        );
      }
    });
  }

  it("los botones de la bifurcación están ocultos mientras no haya JS", () => {
    // Un botón que no hace nada es peor que no tenerlo: el propio comentario del CSS lo dice. La regla
    // tiene que existir FUERA del ámbito `.js`, y su contraria dentro.
    const hoja = css().replace(/\s+/g, " ");
    expect(hoja, "falta la regla que oculta los botones sin JS").toMatch(
      /(?<!\.js )\.bifurcacion__botones\s*\{[^}]*display: ?none/,
    );
    expect(hoja, "falta la regla que los muestra con JS").toMatch(
      /\.js \.bifurcacion__botones\s*\{[^}]*display: ?flex/,
    );
  });

  it("hay una región principal y el enlace de salto apunta a algo enfocable", () => {
    for (const { codigo } of PAGINAS) {
      const fuente = html[codigo] ?? "";
      expect(fuente, `${codigo} no tiene <main>`).toContain("<main>");
      const destino = /href="#([^"]+)"/.exec(fuente)?.[1];
      expect(destino, `${codigo} no tiene enlace de salto`).toBeDefined();
      // Sin `tabindex="-1"`, Safari+VoiceOver deja el foco donde estaba: el enlace de salto no salta.
      expect(fuente).toMatch(new RegExp(`id="${destino ?? ""}"[^>]*tabindex="-1"`));
    }
  });
});

describe("mientras el correo sea un marcador, la página lo dice", () => {
  // Publicar dos llamadas a la acción muertas sin avisar deja a alguien escribiendo a un buzón que no
  // existe, y creyendo que nos ha escrito — en una página cuyo argumento entero es no prometer lo que
  // no hay. El aviso sobrevivió sin test hasta que la batería lo mutó (M21).
  for (const { codigo, copy } of PAGINAS) {
    it(`${codigo}: el aviso aparece, y una vez por vía`, () => {
      if (!CORREO_ES_MARCADOR) return;
      const visible = textoVisible(html[codigo] ?? "");
      const veces = visible.split(copy.bifurcacion.avisoCorreo).length - 1;
      expect(veces, `el aviso del marcador no sale dos veces en ${codigo}`).toBe(2);
    });
  }
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

  /**
   * Orígenes externos, comparando el HOST EXACTO y no el prefijo de la cadena.
   *
   * `startsWith("https://github.com")` daba por propios `https://github.com.evil.tld/x` y
   * `https://github.community/x`. Es exactamente el bug que este mismo repo arregló en
   * `src/schema/task.ts` para el consentimiento —confusión de host por comparar cadenas en vez de
   * `URL.hostname`— reintroducido aquí en los tests de la web. Lo cazó `seguridad` en RELE-3.
   */
  const PROPIOS = new Set(["github.com"]);
  const origenesDe = (fuente: string): string[] =>
    [...new Set(fuente.match(/https?:\/\/[^\s"'()<>]+/gi) ?? [])].filter((u) => {
      try {
        return !PROPIOS.has(new URL(u).hostname);
      } catch {
        return true;
      }
    });

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

  it("las fuentes declaradas existen de verdad en el sitio construido", () => {
    // Una @font-face que apunta a un fichero que no se ha copiado falla en silencio: el navegador usa
    // la pila de reserva y la página se ve «casi bien».
    const rutas = [...new Set(css().match(/url\(\/fonts\/[^)]+\)/g) ?? [])].map((u) =>
      u.slice("url(".length, -1),
    );
    expect(rutas.length).toBeGreaterThan(0);
    for (const ruta of rutas) {
      expect(existsSync(join(DIST, ruta)), `falta ${ruta} en dist/`).toBe(true);
    }
  });

  it("no se sirve dos veces el mismo fichero de fuente con dos nombres", () => {
    // Google devuelve la MISMA url para varios pesos cuando la familia es variable, y el script los
    // guardaba por separado: 93 KB duplicados de 202. Lo cazó `seguridad` comparando checksums, no
    // leyendo el script. Esto lo convierte en gate: si alguien toca `fetch-fonts.mjs` y pierde la
    // deduplicación, la suite se pone roja en vez de engordar la página en silencio.
    const dir = join(DIST, "fonts");
    const porHash = new Map<string, string[]>();
    for (const f of readdirSync(dir)) {
      const hash = createHash("sha256").update(readFileSync(join(dir, f))).digest("hex");
      porHash.set(hash, [...(porHash.get(hash) ?? []), f]);
    }
    const duplicados = [...porHash.values()].filter((fs) => fs.length > 1);
    expect(duplicados, "ficheros de fuente idénticos servidos con nombres distintos").toEqual([]);
  });
});
