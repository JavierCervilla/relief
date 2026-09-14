#!/usr/bin/env node
/**
 * Chequeo determinista de sinks peligrosos en los `.astro`.
 *
 * Existe porque **semgrep no tiene lenguaje Astro**: lo comprobó `seguridad` pidiendo el `paths` del
 * JSON y `Landing.astro` no aparecía ni en `scanned` ni en `skipped`. O sea que el único fichero del
 * paquete con markup y manipulación del DOM es exactamente el que el SAST no mira, y el peldaño 2 de
 * la escalera reportaba verde sobre él. Este repo ya institucionalizó esa preocupación —`gate-lint`,
 * el job `gates-honestos`, la guarda de «las tres herramientas están de verdad en el PATH»—: **verde
 * tiene que significar escaneado**. Una lectura manual lo compensó una vez; eso no escala.
 *
 * No pretende ser un SAST. Cubre lo que en una plantilla Astro convierte texto en código, que es una
 * lista corta y estable. Si aparece algo legítimo, se declara con `astro-sink-allow: <motivo>` en la
 * misma línea o en la anterior, igual que hacen los otros gates del repo.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Lo que convierte una cadena en markup o en código dentro de una plantilla. */
const SINKS = [
  { patron: /\bset:html\b/, que: "set:html — inserta markup sin escapar" },
  { patron: /\bis:raw\b/, que: "is:raw — desactiva el escapado de Astro" },
  { patron: /\.innerHTML\s*=/, que: "innerHTML" },
  { patron: /\.outerHTML\s*=/, que: "outerHTML" },
  { patron: /\binsertAdjacentHTML\b/, que: "insertAdjacentHTML" },
  { patron: /\bdocument\.write\b/, que: "document.write" },
  { patron: /\beval\s*\(/, que: "eval" },
  { patron: /\bnew\s+Function\s*\(/, que: "new Function" },
  { patron: /\bjavascript:/, que: "URL javascript:" },
];

function astros(dir, salida = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) astros(ruta, salida);
    else if (entrada.endsWith(".astro")) salida.push(ruta);
  }
  return salida;
}

const ficheros = astros(RAIZ);
if (ficheros.length === 0) {
  process.stderr.write("check-astro-sinks: no hay ni un .astro que escanear. ¿Ruta equivocada?\n");
  process.exit(2);
}

let hallazgos = 0;
for (const fichero of ficheros) {
  const lineas = readFileSync(fichero, "utf8").split("\n");
  lineas.forEach((linea, i) => {
    // La declaración vale en la misma línea o en la anterior, como en los otros gates del repo. La
    // vecindad se arma aparte y no dentro de la llamada: con la concatenación pegada al `.exec(`,
    // semgrep la confundía con un `child_process.exec` y ponía la escalera en rojo. Es un falso
    // positivo, pero se arregla el código en vez de silenciar al escáner — un `nosemgrep` aquí sería
    // deuda por comodidad, y esta línea se lee mejor así.
    const vecindad = `${lineas[i - 1] ?? ""}\n${linea}`;
    const declarado = /astro-sink-allow:\s*(.+)/.exec(vecindad);
    for (const { patron, que } of SINKS) {
      if (!patron.test(linea)) continue;
      if (declarado !== null) {
        process.stdout.write(`  EXCEPCION ${que} — ${fichero}:${i + 1} — ${declarado[1]?.trim()}\n`);
        continue;
      }
      process.stdout.write(`  SINK ${que} — ${fichero}:${i + 1}\n`);
      hallazgos += 1;
    }
  });
}

process.stdout.write(
  `check-astro-sinks: ${ficheros.length} fichero(s), ${SINKS.length} patrones, ${hallazgos} hallazgo(s).\n`,
);
process.exit(hallazgos === 0 ? 0 : 1);
