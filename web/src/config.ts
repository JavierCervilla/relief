/**
 * La dirección de contacto de la landing. **Única en todo el repositorio, a propósito.**
 *
 * Publicar un correo en una página pública es irreversible: los recolectores de direcciones no
 * olvidan. Por eso el valor real no lo pone el agente — lo pone una persona, aquí, en una línea. Un
 * test comprueba que la cadena aparece en **este** fichero y en ningún otro sitio del código fuente,
 * para que cambiarla siga costando una línea el día que haya que cambiarla.
 *
 * Mientras siga siendo el marcador de abajo, la página se renderiza con él tal cual. Se ve, se lee y
 * nadie confunde una web publicada con una web terminada: un `mailto:` roto y visible es mejor que
 * una dirección inventada que parezca buena.
 */
export const CORREO_CONTACTO = "PENDIENTE@relevo.example";

/** ¿Sigue siendo el marcador? Lo usan el aviso de la página y los tests. */
export const CORREO_ES_MARCADOR = CORREO_CONTACTO.startsWith("PENDIENTE@");
