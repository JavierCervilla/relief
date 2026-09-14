/**
 * Lo que esta página tiene PROHIBIDO decir, en un sitio solo, para que los tests de los dos idiomas y
 * los del HTML renderizado midan contra la misma lista.
 */

/**
 * Organizaciones reales que aparecen como *fixtures* en el repositorio del servidor.
 *
 * Son datos de prueba, **no socios**. Nombrarlas en una página pública sugiere un respaldo que no
 * existe, y ese es exactamente el daño que el diseño de consentimiento de Relevo intenta evitar: si
 * exigimos permiso por escrito para sacar una tarea de un backlog ajeno, no podemos usar el nombre de
 * una ONG como decorado. Decisión del humano, 2026-09-14.
 */
export const NOMBRES_VETADOS: readonly string[] = [
  "Kiva",
  "Plena Inclusión",
  "Plena Inclusion",
  "Cochrane",
  "Ghostty",
];

/**
 * Los ÚNICOS números que pueden aparecer en el texto visible, con el motivo por el que cada uno está
 * permitido. Cualquier otro dígito es, por defecto, una métrica de actividad inventada — y no hay ni
 * una tarea completada, así que sería falso.
 */
export const NUMEROS_PERMITIDOS: ReadonlyMap<string, string> = new Map([
  ["3", "tope de tareas por sesión (y el 3 de AGPL-3.0)"],
  ["10", "tope de tareas al día"],
  ["1", "tope de parches por sesión"],
  ["0", "el 0 de AGPL-3.0"],
  ["2026", "el año del estudio sobre AI-DDoS que se cita"],
  ["294", "repositorios del estudio"],
  ["67", "porcentaje de mantenedores que declara carga significativa"],
  ["800", "mantenedores encuestados"],
  ["2", "los DOS permisos de la vía OSS, y los «dos millones de pull requests» del estudio"],
  ["1", "duplicado intencionado: ver arriba"],
  ["4", "el 4 de §4"],
  ["5", "el 5 de §5"],
]);
