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

  /**
   * Sin servicio de imagen.
   *
   * La landing no tiene ni una imagen —es un anti-objetivo del brief: ni fotos de stock, ni
   * ilustraciones, ni «IA» dibujada como un cerebro—, y el servicio por defecto arrastra `sharp` con
   * `libvips` y `libheif` nativos. Eso es el trozo más grande de superficie nueva del paquete y es
   * exactamente donde vivían las CVE que obligaron a subir de Astro 5 a 7 (RCE por optimización AVIF,
   * y las heredadas de libvips/libheif). `seguridad` lo señaló: dependencia nativa pesada instalada
   * para una página con cero imágenes.
   *
   * Si algún día entra una imagen, esto se quita y se vuelve a mirar el árbol. Hasta entonces, la
   * superficie que no existe no hay que auditarla.
   */
  image: { service: { entrypoint: "astro/assets/services/noop" } },
});
