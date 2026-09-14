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
  "Cochrane",
  "Ghostty",
];

/**
 * Los nombres propios que la página **sí** dice, cada uno con por qué se le permite.
 *
 * Existe por la asimetría que encontró `qa-adversario`: `NOMBRES_VETADOS` es una **lista negra** —un
 * oráculo de reconocimiento, sólo ve lo que ya está escrito en él— mientras que `CIFRAS_DECLARADAS`
 * es una **lista blanca**, donde un número nuevo se pone rojo por ser nuevo. Dos promesas simétricas
 * defendidas con polaridades opuestas a cien líneas de distancia.
 *
 * Y no era teórico: la página **nombraba a GitHub y a Claude Code** tres líneas debajo de la frase que
 * decía que no nombra a nadie sin permiso. No hizo falta mutar nada — la promesa ya estaba incumplida.
 * Lo que cedió fue la frase, porque era absoluta y la página no lo es: omitir la forja y la
 * herramienta haría la página incomprensible, y decir «no nombro a nadie» mientras los nombras es
 * exactamente el tipo de afirmación de más que este proyecto entero intenta no cometer.
 *
 * El invariante que sostiene el test: **si un nombre de aquí aparece en la página, la divulgación del
 * §2 tiene que aparecer también.** Nombrar y explicar por qué se nombra van juntos o no van.
 */
export const NOMBRES_PERMITIDOS: ReadonlyMap<string, string> = new Map([
  ["Claude Code", "la herramienta en la que el voluntario ejecuta la tarea; sin nombrarla no se entiende el modo pull manual"],
  ["Claude", "aparece como parte de «Claude Code» y en «una suscripción a Claude»"],
  ["GitHub", "la forja donde vive el código de Relevo, enlazada en el pie"],
  ["Relevo", "el propio proyecto"],
  ["AGPL", "la licencia"],
]);

/**
 * Normaliza un texto para comparar NOMBRES: sin tildes, sin mayúsculas y sin separadores.
 *
 * La versión anterior comparaba grafías de display, y `qa-adversario` señaló que la forma en que de
 * verdad se nombra a una organización en una web es un enlace. Cuatro de los cinco nombres vetados son
 * de una palabra y sobrevivían al encoding; el único de dos —«Plena Inclusión», que es exactamente la
 * audiencia de la ruta en castellano— era el único cuyo dominio, handle y slug pasaban limpios:
 *
 *     plenainclusion.org · @PlenaInclusion · /casos/plena-inclusion/ · «Plena  Inclusión»
 *
 * Lo que lo agrava es que la normalización SÍ se había considerado: la lista traía «Plena Inclusion»
 * sin tilde. Se normalizó el diacrítico y no el separador — y el separador es justo el que se pierde
 * al escribir una URL. Normalizando los dos, esa entrada duplicada sobra y se ha quitado.
 */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

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

/**
 * Cantidades escritas EN LETRA, que el oráculo de dígitos no puede ver.
 *
 * El docstring de `CIFRAS_DECLARADAS` presentaba esto como un límite hipotético — «también pasa un
 * número escrito en letra (*una docena de organizaciones*)» — y `qa-adversario` demostró que ya estaba
 * en uso: la página publicaba **tres** cuantificadores en letra, uno de ellos sobre Relevo mismo
 * («contesta una persona, normalmente en un par de días», un compromiso de capacidad publicado dos
 * párrafos después de «no hay voluntarios activos»). Ese se ha retirado del texto.
 *
 * Un límite documentado que ya está en uso en producción no es un límite: es una excepción sin
 * declarar. Así que se declaran, con el mismo mecanismo que los dígitos.
 *
 * El vocabulario es corto a propósito: sólo palabras de MAGNITUD, las que podrían expresar volumen de
 * actividad. «dos permisos» o «las dos vías» son estructura de la página, no una cifra, y meterlas
 * aquí convertiría el gate en ruido — que es el camino más corto a que alguien lo relaje.
 */
export const MAGNITUDES_EN_LETRA =
  /\b(docenas?|decenas?|cientos|centenares|miles|mill[oó]n(?:es)?|dozens?|hundreds|thousands|millions?)\b/gi;

/** Frases donde una magnitud en letra es legítima, con su motivo. */
export const MAGNITUDES_DECLARADAS: ReadonlyMap<string, string> = new Map([
  ["más de dos millones de pull requests", "volumen del estudio de 2026 que se cita"],
  ["more than two million pull requests", "idem, en inglés"],
]);

/** Magnitudes en letra que no están dentro de una frase declarada. */
export function magnitudesSinDeclarar(texto: string): string[] {
  let resto = texto.replace(/\s+/g, " ");
  for (const frase of MAGNITUDES_DECLARADAS.keys()) resto = resto.split(frase).join(" ");
  return [...new Set(resto.match(MAGNITUDES_EN_LETRA) ?? [])].map((m) => m.toLowerCase());
}
