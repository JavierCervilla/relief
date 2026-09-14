/**
 * El texto, medido contra lo que la página tiene prohibido decir.
 *
 * Estos tests corren sobre los DICCIONARIOS. Los que corren sobre el HTML renderizado viven en
 * `render.test.ts`, y son los que de verdad cierran el agujero — aquí se caza antes y con mejor
 * mensaje de error.
 */
import { describe, expect, it } from "vitest";

import { en } from "../src/i18n/en.js";
import { es } from "../src/i18n/es.js";
import type { Copy } from "../src/i18n/types.js";

import { NOMBRES_VETADOS } from "./vetos.js";

const IDIOMAS: readonly [string, Copy][] = [
  ["es", es],
  ["en", en],
];

/** Todo el texto de un diccionario, aplanado, CON su ruta: hay sitios donde el vacío es legítimo. */
function conRuta(valor: unknown, prefijo = "", salida: [string, string][] = []): [string, string][] {
  if (typeof valor === "string") salida.push([prefijo, valor]);
  else if (Array.isArray(valor)) valor.forEach((v, i) => conRuta(v, `${prefijo}[${i}]`, salida));
  else if (valor !== null && typeof valor === "object")
    for (const [k, v] of Object.entries(valor))
      conRuta(v, prefijo === "" ? k : `${prefijo}.${k}`, salida);
  return salida;
}

/** Todo el texto de un diccionario, aplanado. */
function textos(valor: unknown): string[] {
  return conRuta(valor).map(([, t]) => t);
}

/**
 * Dónde una cadena vacía es correcta y no un descuido.
 *
 * El cuerpo de cada `mailto:` es una lista de líneas, y las vacías son los renglones en blanco que
 * separan el saludo de los campos. Se listan aquí en vez de relajar el test a «casi nunca vacío»:
 * la primera versión medía «ningún texto vacío» a secas y se puso roja con razón — pero por un fallo
 * MÍO, no del diccionario. Un aserto que se relaja al primer rojo deja de ser un aserto.
 */
const VACIO_LEGITIMO = /^bifurcacion\.(ong|oss)\.correo\.cuerpo\[\d+\]$/;

/**
 * Las rutas de todas las claves de un objeto, en orden estable.
 *
 * OJO al `salida.push(ruta)` de los elementos de array: sin él, un elemento que sea una CADENA no
 * dejaba rastro, porque la primera línea devolvía sin empujar para cualquier no-objeto. Los arrays de
 * objetos (`pasos`, `puntos`, `filas`, `topes`) sí quedaban cubiertos; los de cadenas —`parrafos`,
 * `correo.cuerpo`, `bloqueCodigo`— no.
 *
 * Lo que eso permitía, reproducido por el verificador con la suite en 54/54 verde: **borrar del inglés
 * la frase «no hay voluntarios activos, ni tareas completadas, ni ninguna organización a bordo»** y que
 * no se pusiera rojo nada. El castellano la decía y el inglés podía dejar de decirla — que es
 * literalmente lo que `types.ts` promete que no puede pasar.
 */
function claves(valor: unknown, prefijo = "", salida: string[] = []): string[] {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => {
      const ruta = `${prefijo}[${i}]`;
      salida.push(ruta);
      claves(v, ruta, salida);
    });
    return salida;
  }
  if (valor === null || typeof valor !== "object") return salida;
  for (const [k, v] of Object.entries(valor)) {
    const ruta = prefijo === "" ? k : `${prefijo}.${k}`;
    salida.push(ruta);
    claves(v, ruta, salida);
  }
  return salida;
}

describe("ninguna organización real se nombra en la página", () => {
  for (const [codigo, copy] of IDIOMAS) {
    it(`${codigo}: no aparece ningún nombre vetado`, () => {
      const todo = textos(copy).join("\n").toLowerCase();
      for (const nombre of NOMBRES_VETADOS) {
        expect(todo, `«${nombre}» no puede aparecer en el texto`).not.toContain(nombre.toLowerCase());
      }
    });
  }

  it("el test sabe ponerse rojo", () => {
    // Un veto que nunca se ha visto fallar no prueba nada. Se comprueba contra un texto que SÍ lo
    // viola, no contra el de producción.
    const impostor = "Trabajamos con Kiva desde el principio.";
    const cazado = NOMBRES_VETADOS.some((n) => impostor.toLowerCase().includes(n.toLowerCase()));
    expect(cazado).toBe(true);
  });
});

describe("los dos idiomas dicen lo mismo, o uno de los dos miente", () => {
  it("sabe ponerse rojo si a un idioma le falta un PÁRRAFO, no sólo una clave", () => {
    // El caso concreto que sobrevivía: un elemento string dentro de un array. Se ejercita contra una
    // copia mutilada, no contra producción.
    // `Copy` declara los arrays `readonly`, así que el cast pasa por `unknown`: mutilar la copia es
    // justo lo que este test necesita hacer, y el tipo está bien al impedirlo en producción.
    const mutilado = structuredClone(en) as unknown as { estado: { parrafos: string[] } };
    mutilado.estado.parrafos.pop();
    expect(claves(mutilado)).not.toEqual(claves(es));
  });

  it("tienen exactamente la misma forma, incluidos los elementos de cada lista", () => {
    // El tipo `Copy` ya obliga a que no falte una CLAVE. Lo que el tipo no ve es que a un idioma le
    // falte un PASO, una fila de la ficha o un párrafo: las listas son `readonly T[]` y una lista más
    // corta compila igual de bien. Aquí es donde se caza.
    expect(claves(en)).toEqual(claves(es));
  });

  it("ningún texto se ha quedado sin traducir (vacío o idéntico salvo lo que debe serlo)", () => {
    for (const [codigo, copy] of IDIOMAS) {
      for (const [ruta, t] of conRuta(copy)) {
        if (VACIO_LEGITIMO.test(ruta)) continue;
        expect(t.trim(), `${codigo}: texto vacío en ${ruta}`).not.toBe("");
      }
    }
    // Lo que SÍ puede coincidir entre idiomas, declarado UNO A UNO. Todo lo demás repetido sería
    // copiar y pegar sin traducir.
    //
    // Antes había además un filtro `t.length > 24`, y con él esta lista era CÓDIGO MUERTO: sus ocho
    // entradas miden entre 1 y 21 caracteres, así que el filtro las excluía a todas antes de que la
    // lista llegara a opinar. El comentario explicaba un mecanismo que no se ejecutaba nunca. Sin el
    // umbral, la lista pasa a sostener el test de verdad: cada coincidencia entre idiomas tiene que
    // estar justificada aquí, corta o larga.
    const permitidoIdentico = new Set([
      "3",
      "10",
      "1",
      "AGPL-3.0",
      "Relevo",
      "es",
      "en",
      "# AI-CONTRIBUTIONS.md",
      "",
    ]);
    const esTextos = textos(es);
    const enTextos = textos(en);
    const identicos = [
      ...new Set(esTextos.filter((t, i) => enTextos[i] === t && !permitidoIdentico.has(t))),
    ];
    expect(identicos, "textos idénticos en los dos idiomas: ¿sin traducir?").toEqual([]);
  });
});

describe("el texto cabe en las fuentes que servimos", () => {
  it("ningún carácter cae fuera del subconjunto latin", () => {
    // Servimos SÓLO el subconjunto `latin` de las tres familias (202 KB en vez de 344). Si alguien
    // mete un carácter fuera de rango, el navegador lo pinta con la fuente de reserva y la línea se
    // descuadra sin avisar. Esto lo convierte en rojo.
    const enLatin = (c: string): boolean => {
      const n = c.codePointAt(0) ?? 0;
      return (
        n <= 0x24f ||
        [0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x2014, 0x2013, 0x2122, 0x20ac, 0x2212].includes(n)
      );
    };
    for (const [codigo, copy] of IDIOMAS) {
      const fuera = [...new Set([...textos(copy).join("")].filter((c) => !enLatin(c)))];
      expect(fuera, `${codigo}: caracteres fuera del subconjunto latin`).toEqual([]);
    }
  });
});
