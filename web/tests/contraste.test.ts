/**
 * El contraste, MEDIDO — y medido sobre `tokens.css`, no sobre una copia de los valores.
 *
 * El criterio del plan dice «contraste AA verificado por herramienta, no a ojo». Un test que
 * reescribiera los hex aquí verificaría su propia copia: alguien cambia el token, el test sigue verde,
 * y la página se vuelve ilegible sin que nada se entere. Así que los valores se PARSEAN del fichero
 * que el navegador va a servir.
 *
 * Conversión OKLCH→sRGB por la matriz de Björn Ottosson y luminancia relativa por WCAG 2.1. Sin
 * dependencias: son treinta líneas de aritmética y traerse una librería para esto sería peor.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const TOKENS = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");

/** Lee `--nombre: oklch(L C H);` del fichero de tokens. */
function token(nombre: string): [number, number, number] {
  const re = new RegExp(`--${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`);
  const m = re.exec(TOKENS);
  if (m === null) throw new Error(`no encuentro el token --${nombre} en tokens.css`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function aSrgb([L, C, H]: [number, number, number]): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Luminancia relativa WCAG. El canal lineal ya lo da la conversión; sólo hay que recortar. */
function luminancia(nombre: string): number {
  const [r, g, b] = aSrgb(token(nombre)).map((c) => Math.min(1, Math.max(0, c))) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Cada par que la página pinta de verdad, con el mínimo que le toca.
 *
 * 4.5 para texto normal, 3.0 para texto grande (≥24 px, o ≥18.66 px en negrita) y para componentes de
 * interfaz. Los tamaños no son una suposición: están en `landing.css` y se citan en la columna.
 */
const PARES: readonly { frente: string; fondo: string; minimo: number; donde: string }[] = [
  { frente: "tinta", fondo: "arena", minimo: 4.5, donde: "texto corrido" },
  { frente: "tinta", fondo: "arena-honda", minimo: 4.5, donde: "texto en banda honda" },
  { frente: "tinta-suave", fondo: "arena", minimo: 4.5, donde: "entradilla y texto secundario" },
  { frente: "petroleo", fondo: "arena", minimo: 4.5, donde: "titulares sobre arena" },
  { frente: "petroleo", fondo: "arena-honda", minimo: 4.5, donde: "titulares en banda honda" },
  { frente: "petroleo-texto", fondo: "arena", minimo: 4.5, donde: "etiquetas mono (10 px)" },
  { frente: "petroleo-texto", fondo: "arena-honda", minimo: 4.5, donde: "etiquetas mono en banda" },
  { frente: "accion", fondo: "arena", minimo: 4.5, donde: "enlaces" },
  { frente: "accion", fondo: "arena-honda", minimo: 4.5, donde: "enlaces en banda honda" },
  { frente: "arena", fondo: "accion", minimo: 4.5, donde: "texto de los botones y la CTA" },
  { frente: "papel-en-petroleo", fondo: "petroleo", minimo: 4.5, donde: "texto del §2" },
  { frente: "suave-en-petroleo", fondo: "petroleo", minimo: 4.5, donde: "cuerpo del §2 y pie" },
  { frente: "accion-en-petroleo", fondo: "petroleo", minimo: 4.5, donde: "enlaces del pie, filetes §2" },
  { frente: "accion-viva", fondo: "arena", minimo: 3, donde: "ordinales de los pasos (40 px)" },
  { frente: "accion-viva", fondo: "arena-honda", minimo: 3, donde: "cifras de los topes (52 px)" },
  { frente: "petroleo-vivo", fondo: "arena", minimo: 3, donde: "marcadores § (30 px) y filetes" },
  { frente: "petroleo-vivo", fondo: "arena-honda", minimo: 3, donde: "marcadores § en banda honda" },
];

describe("contraste AA sobre los tokens que la página sirve de verdad", () => {
  for (const { frente, fondo, minimo, donde } of PARES) {
    it(`${frente} sobre ${fondo} (${donde}) ≥ ${minimo}`, () => {
      const medido = contraste(frente, fondo);
      expect(medido, `${donde}: ${medido.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimo);
    });
  }

  it("sabe ponerse rojo: un par deliberadamente malo no pasa", () => {
    // Sin esto, un fallo en la conversión de color daría números enormes y todo pasaría siempre.
    expect(contraste("arena", "arena-honda")).toBeLessThan(1.5);
  });

  it("los números que el brief afirma son los que salen de aquí", () => {
    // El brief publica «tinta 14.0» y «accion 5.2». Si alguien retoca un token y no el brief, uno de
    // los dos documentos pasa a mentir. Esto ata los dos.
    expect(contraste("tinta", "arena")).toBeCloseTo(14.0, 0);
    expect(contraste("accion", "arena")).toBeCloseTo(5.2, 0);
    expect(contraste("papel-en-petroleo", "petroleo")).toBeCloseTo(12.1, 0);
  });
});
