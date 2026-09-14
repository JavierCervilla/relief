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
 */
export function construirMailto(correo: Correo): string {
  const asunto = encodeURIComponent(correo.asunto);
  const cuerpo = encodeURIComponent(correo.cuerpo.join("\n"));
  return `mailto:${CORREO_CONTACTO}?subject=${asunto}&body=${cuerpo}`;
}
