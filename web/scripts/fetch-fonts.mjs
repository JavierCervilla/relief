/**
 * Descarga los subconjuntos latinos de las tres familias y las deja AUTO-ALOJADAS en `public/fonts/`,
 * generando `src/styles/fonts.css` con rutas locales.
 *
 * Por qué existe, y por qué no basta con el `<link>` de Google:
 * un anti-objetivo del brief es no filtrar a los visitantes a un tercero. La página pide confianza a
 * mantenedores de open source y a ONGs que manejan datos sensibles; empezar mandando su IP y su
 * user-agent a Google contradice el argumento antes del primer párrafo. Alojarlas cuesta seis ficheros.
 *
 * Sólo `latin` y `latin-ext`: es lo que necesitan el castellano y el inglés. Los subconjuntos griego,
 * cirílico y vietnamita que sirve Google aquí serían peso muerto.
 *
 * Se ejecuta a mano, no en el build: las fuentes se versionan. Un build que dependa de la red para
 * renderizar texto es un build que se cae el día que Google cambie una URL.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const DESTINO_FUENTES = join(RAIZ, "public", "fonts");
const DESTINO_CSS = join(RAIZ, "src", "styles", "fonts.css");

/** Un navegador de verdad: con otro user-agent, Google sirve TTF en vez de woff2. */
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Rangos que nos sirven. El resto del fichero de Google se descarta.
 *
 * Sólo `latin`: cubre entero el castellano (á é í ó ú ñ ü ¿ ¡) y el inglés, más « » y §, que la página
 * usa. `latin-ext` añadía 142 KB de glifos que ningún texto de esta web puede contener — peso muerto
 * con buena excusa. Si algún día entra un idioma que lo necesite, es una entrada en este conjunto.
 */
const SUBCONJUNTOS = new Set(["latin"]);

/**
 * Pesos EXACTOS que usa la página, no rangos variables.
 *
 * Se midió: pedir la variable de Newsreader con eje óptico daba 129 KB sólo para `latin`, y la página
 * usa dos pesos. Instancias estáticas de esos dos: una fracción. Una landing que tarda en pintar el
 * texto por traerse ejes tipográficos que nadie mueve es peso muerto con buena excusa.
 */
const FAMILIAS = [
  { nombre: "Newsreader", consulta: "Newsreader:wght@400;500", archivo: "newsreader" },
  { nombre: "Archivo", consulta: "Archivo:wght@400;600", archivo: "archivo" },
  { nombre: "JetBrains Mono", consulta: "JetBrains+Mono:wght@400", archivo: "jetbrains-mono" },
];

async function bajar(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res;
}

/** Parte el CSS de Google en bloques `/* subconjunto *\/ @font-face { ... }`. */
function trocear(css) {
  const bloques = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let m;
  while ((m = re.exec(css)) !== null) bloques.push({ subconjunto: m[1], regla: m[2] });
  return bloques;
}

async function main() {
  await mkdir(DESTINO_FUENTES, { recursive: true });
  const piezas = [
    "/*",
    " * Fuentes auto-alojadas. GENERADO por `scripts/fetch-fonts.mjs` — no editar a mano.",
    " *",
    " * Sólo `latin` y `latin-ext`: es lo que necesitan el castellano y el inglés.",
    " * `font-display: swap` a propósito — el texto es el producto, y verlo en la pila de reserva",
    " * durante 100 ms es mejor que no verlo.",
    " */",
    "",
  ];
  let total = 0;

  for (const familia of FAMILIAS) {
    const css = await (
      await bajar(`https://fonts.googleapis.com/css2?family=${familia.consulta}&display=swap`)
    ).text();

    const bloques = trocear(css).filter((b) => SUBCONJUNTOS.has(b.subconjunto));
    if (bloques.length === 0) throw new Error(`sin subconjuntos latinos para ${familia.nombre}`);

    for (const { subconjunto, regla } of bloques) {
      const urlFuente = /url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/.exec(regla)?.[1];
      if (urlFuente === undefined) throw new Error(`sin url en ${familia.nombre}/${subconjunto}`);

      const peso = /font-weight:\s*(\d+)/.exec(regla)?.[1] ?? "400";
      const nombreArchivo = `${familia.archivo}-${peso}-${subconjunto}.woff2`;
      const bytes = Buffer.from(await (await bajar(urlFuente)).arrayBuffer());
      await writeFile(join(DESTINO_FUENTES, nombreArchivo), bytes);
      total += bytes.length;

      piezas.push(
        regla
          .replace(/url\(https:\/\/fonts\.gstatic\.com[^)]+\)/, `url("/fonts/${nombreArchivo}")`)
          .replace(/;\s*}/, ";\n}"),
        "",
      );
      process.stdout.write(`  ${nombreArchivo.padEnd(34)} ${(bytes.length / 1024).toFixed(1)} KB\n`);
    }
  }

  await writeFile(DESTINO_CSS, piezas.join("\n"));
  process.stdout.write(`\nfonts.css escrito · ${(total / 1024).toFixed(1)} KB en total\n`);
}

main().catch((err) => {
  process.stderr.write(`fetch-fonts: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
