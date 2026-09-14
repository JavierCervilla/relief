import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Los tests de honestidad leen `dist/`, así que el build tiene que haber corrido antes.
    // Lo encadena `npm run gate`; no se lanza desde aquí para que un test no dispare un build de
    // minuto y medio cada vez que alguien corre la suite en modo watch.
  },
});
