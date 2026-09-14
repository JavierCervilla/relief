import type { Copy } from "../src/i18n/types.js";

/**
 * Lo que esta página tiene PROHIBIDO decir, en un sitio solo, para que los tests de los dos idiomas y
 * los del HTML renderizado midan contra la misma definición.
 */

/**
 * Organizaciones reales que aparecen como *fixtures* en el repositorio del servidor.
 *
 * Son datos de prueba, **no socios**. Nombrarlas en una página pública sugiere un respaldo que no
 * existe, y ese es exactamente el daño que el diseño de consentimiento de Relevo intenta evitar.
 * Decisión del humano, 2026-09-14.
 */
export const NOMBRES_VETADOS: readonly string[] = [
  "Kiva",
  "Plena Inclusión",
  "Plena Inclusion",
  "Cochrane",
  "Ghostty",
];

/**
 * El oráculo de las cifras: **por contexto, no por lista blanca de dígitos**.
 *
 * La primera versión era un `Set` de números permitidos, y el verificador la rompió en dos golpes. Con
 * los ordinales `§1…§5` y los tres topes dentro, la lista acababa admitiendo `0,1,2,3,4,5,10`
 * **estuvieran donde estuvieran**, así que «Ya hay 10 organizaciones a bordo y 3 voluntarios activos»
 * pasaba el gate entero con la suite en verde. Un veto que se llama «no hay ni una cifra de actividad»
 * y sólo mira qué dígitos aparecen promete mucho más de lo que su mecanismo puede dar.
 *
 * Éste mira DÓNDE aparecen. Se construyen los pocos fragmentos donde una cifra es legítima —los topes
 * con su etiqueta, los párrafos del estudio, la licencia, los ordinales de sección—, se borran del
 * texto, y **cualquier dígito que sobreviva es un intruso**. Cambiar el mensaje deja de colar por
 * llevar un número ya visto.
 *
 * Límite honesto que este oráculo NO cubre y ningún regex va a cubrir: un número escrito en letra
 * («una docena de organizaciones»). Eso es lectura humana, y por eso el veto de nombres y éste no
 * sustituyen a la revisión — la hacen barata al quitarle lo mecánico.
 */
export function contextosConCifraLegitima(copy: Copy): readonly string[] {
  return [
    // Los topes. En el texto aplanado cada uno sale como «3 Tareas por sesión»: la cifra va PEGADA a
    // su etiqueta, y esa unión es justo lo que la hace un tope y no una métrica suelta.
    ...copy.limites.topes.map((tope) => `${tope.cifra} ${tope.etiqueta}`),
    // Los ordinales de los tres pasos, cada uno pegado al título de SU paso. El oráculo los reclamó
    // en cuanto se estrenó, y esa es la diferencia con la lista blanca vieja: aquélla admitía `1`,
    // `2` y `3` en cualquier sitio de la página precisamente porque estos ordinales existen, y de
    // paso dejaba entrar «3 voluntarios activos». Aquí hay que declarar dónde vale cada uno.
    ...copy.queEs.pasos.map((paso, i) => `${i + 1} ${paso.titulo}`),
    // Los dos párrafos del estudio de 2026, con sus 294 repos, su 67 % y sus 800 mantenedores.
    ...copy.limites.parrafos,
    // «AGPL-3.0».
    copy.cabecera.licencia,
    copy.pie.licencia,
    // Las etiquetas de las fichas («Permiso 1», «Permiso 2»): ordinales, misma familia que `§N` y que
    // los pasos. Se declaran ENTERAS, no el dígito suelto.
    //
    // Lo que esto ensancha, dicho en voz alta: una etiqueta podría llevar una métrica («Socios: 42»)
    // y pasaría. Es una superficie de diez caracteres frente a la página entera que admitía la lista
    // blanca anterior, y la etiqueta va en mono a 10 px al lado de su texto, o sea el peor sitio
    // imaginable para esconder una afirmación. Se acepta con ese límite escrito.
    ...[copy.bifurcacion.ong, copy.bifurcacion.oss].flatMap((via) =>
      via.filas.map((fila) => fila.etiqueta),
    ),
  ];
}

/** Ordinales de sección (`§1`…`§5`): los pone la plantilla, no el diccionario. */
export const ORDINALES_DE_SECCION = /§\s*\d+/g;

/**
 * Quita del texto todo contexto donde una cifra es legítima. Lo que quede con dígitos es un hallazgo.
 *
 * Se normalizan los espacios antes de comparar porque el HTML aplanado trae saltos de línea e
 * indentación donde el diccionario tiene un espacio simple.
 */
export function cifrasIntrusas(texto: string, copy: Copy): string[] {
  const normalizar = (t: string): string => t.replace(/\s+/g, " ");
  let resto = normalizar(texto);
  for (const contexto of contextosConCifraLegitima(copy)) {
    resto = resto.split(normalizar(contexto)).join(" ");
  }
  resto = resto.replace(ORDINALES_DE_SECCION, " ");
  return [...new Set(resto.match(/\d+/g) ?? [])];
}
