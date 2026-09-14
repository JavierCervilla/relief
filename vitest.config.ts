import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Los invariantes del claim dependen del reloj (TTL de 30 min). Los tests lo
    // adelantan con temporizadores falsos, así que nunca deben correr en paralelo
    // dentro de un mismo fichero.
    sequence: { concurrent: false },
  },
});
