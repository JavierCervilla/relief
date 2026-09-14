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
 * El oráculo de las cifras: **por cifra citada, con su cuenta y su motivo**.
 *
 * Ha tenido dos versiones antes y las dos las rompió el verificador, en este orden:
 *
 *  1. Una **lista blanca de dígitos**. Entre los ordinales `§1…§5` y los topes acababa admitiendo
 *     `0,1,2,3,4,5,10` estuvieran donde estuvieran, así que «Ya hay 10 organizaciones a bordo y 3
 *     voluntarios activos» pasaba entero.
 *  2. Una lista de **contextos exentos** construida leyendo el propio diccionario. Mejor, pero exentaba
 *     el campo COMPLETO: como `limites.parrafos` está exento por llevar los datos del estudio, meter
 *     «Ya llevamos 1240 tareas completadas.» delante de esa prosa pasaba igual. Unas quince cadenas de
 *     ciento veinte quedaban fuera del veto, y sólo una de las cuatro familias estaba declarada.
 *
 * Ésta cuenta. Cada cifra que la página puede contener está declarada abajo **con cuántas veces** y
 * **por qué**, así que una añadida es un token nuevo o una cuenta que no cuadra. La granularidad es la
 * cifra, no el campo: no hay prosa exenta donde esconder un número.
 *
 * Es deliberadamente **frágil**: añadir un `§6` legítimo pone el test rojo hasta que alguien lo declare
 * aquí con su motivo. Eso es la propiedad, no un efecto secundario — en esta página un número nuevo es
 * una afirmación nueva, y tiene que costar una línea de justificación.
 *
 * Límite honesto que ningún regex va a cubrir: un número escrito en letra («una docena de
 * organizaciones»), o cambiar «3 tareas por sesión» por «3 organizaciones a bordo» sin tocar la cuenta.
 * Eso es lectura humana. El veto no la sustituye: le quita lo mecánico.
 */
export const CIFRAS_DECLARADAS: ReadonlyMap<string, { veces: number; motivo: string }> = new Map([
  ["0", { veces: 2, motivo: "el 0 de AGPL-3.0, en la cabecera y en el pie" }],
  [
    "1",
    {
      veces: 4,
      motivo: "tope de parches · ordinal del paso 1 · marcador §1 · etiqueta «Permiso 1»",
    },
  ],
  ["2", { veces: 3, motivo: "ordinal del paso 2 · marcador §2 · etiqueta «Permiso 2»" }],
  [
    "3",
    {
      veces: 5,
      motivo: "el 3 de AGPL-3.0 ×2 · tope de tareas por sesión · ordinal del paso 3 · marcador §3",
    },
  ],
  ["4", { veces: 1, motivo: "marcador §4" }],
  ["5", { veces: 1, motivo: "marcador §5" }],
  ["10", { veces: 1, motivo: "tope de tareas al día" }],
  ["67", { veces: 1, motivo: "estudio 2026: % de mantenedores que declara carga significativa" }],
  ["294", { veces: 1, motivo: "estudio 2026: repositorios analizados" }],
  ["800", { veces: 1, motivo: "estudio 2026: mantenedores encuestados" }],
  ["2026", { veces: 1, motivo: "el año del estudio que se cita" }],
]);

/**
 * Qué cifras del texto no cuadran con lo declarado. Lista vacía = limpio.
 *
 * Devuelve frases y no números porque el mensaje de error es la mitad del valor de un gate: quien lo
 * vea tiene que saber si lo suyo es una cifra nueva o una repetición de una que ya existía.
 */
export function discrepanciasDeCifras(texto: string): string[] {
  const vistas = new Map<string, number>();
  for (const cifra of texto.match(/\d+/g) ?? []) vistas.set(cifra, (vistas.get(cifra) ?? 0) + 1);

  const fallos: string[] = [];
  for (const [cifra, veces] of vistas) {
    const declarada = CIFRAS_DECLARADAS.get(cifra);
    if (declarada === undefined) {
      fallos.push(`«${cifra}» no está declarada: ¿es una métrica de actividad? No hay ninguna que sea verdad`);
    } else if (declarada.veces !== veces) {
      fallos.push(
        `«${cifra}» sale ${veces} veces y se declararon ${declarada.veces} (${declarada.motivo})`,
      );
    }
  }
  for (const [cifra, { motivo }] of CIFRAS_DECLARADAS) {
    if (!vistas.has(cifra)) fallos.push(`«${cifra}» se declaró (${motivo}) y ya no aparece: ¿sobra?`);
  }
  return fallos.sort();
}
