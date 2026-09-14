import { defineConfig } from "astro/config";

/**
 * Sitio estático puro: sin adaptador, sin islas de framework, sin analítica.
 *
 * `site` NO está fijado a propósito. El dominio todavía no existe, y una URL canónica inventada es peor
 * que no tenerla: le diría a un buscador que la página vive en un sitio donde no vive. Sin `site`, el
 * `canonical` y los `hreflang` salen relativos a la raíz, que funciona. El día que haya dominio, se
 * fija aquí y las dos cosas se vuelven absolutas sin tocar ningún componente.
 */
export default defineConfig({
  trailingSlash: "always",
  build: { format: "directory" },
  compressHTML: true,
});
