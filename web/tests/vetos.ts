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
 * ## El límite, que es de semántica y no de mecanismo
 *
 * Esto preserva la CUENTA, no el SIGNIFICADO. Y el ejemplo que importa no es reetiquetar un tope —eso
 * se ve— sino reencuadrar una cifra **del estudio**, que son las que más aspecto de dato citable
 * tienen y las que un editor de copy podría tocar sin darse cuenta:
 *
 *     "un estudio sobre 294 repositorios"  →  "un despliegue en 294 organizaciones a bordo"
 *
 * Verde, porque el `294` sigue saliendo una vez. También pasa un número escrito en letra («una docena
 * de organizaciones»). Distinguir «294 repositorios» de «294 organizaciones a bordo» es leer, no
 * parsear: el veto no sustituye a la revisión humana, le quita lo mecánico. Lo reprodujo el
 * verificador y se escribe aquí, en el fichero que lo implementa, que es la forma honesta de tener un
 * límite.
 *
 * ## Las cuentas dependen también de la PLANTILLA, no sólo del diccionario
 *
 * Los ordinales `§` y los de los pasos los pone `Landing.astro`. Un cambio estructural —una sección
 * más, renumerar— pondrá esto rojo **por un motivo que no es honestidad**. Quien lo vea tiene que
 * poder distinguirlo antes de diagnosticar mal: si el diff que lo puso rojo toca la plantilla y no el
 * texto, es una cifra que hay que redeclarar, no una métrica que alguien ha colado.
 *
 * ## Y lo que NO hay que hacer cuando se ponga rojo
 *
 * El riesgo de un gate frágil no es la fragilidad: es la fatiga — que alguien, al tercer rojo, relaje
 * el aserto en vez de declarar la cifra. Este repo ya tiene el anticuerpo escrito en `copy.test.ts`:
 * **un aserto que se relaja al primer rojo deja de ser un aserto**. Declarar la cifra cuesta una línea
 * con su motivo; relajar el aserto cuesta el veto entero.
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
