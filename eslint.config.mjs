// Config de ESLint de Relevo.
//
// El preset anti-slop (`eslint.anti-slop.mjs`) viene del framework y da por supuesto un proyecto Next,
// que aporta el parser de TypeScript por su cuenta. Esto es Node puro, así que el parser se pone aquí.
//
// **El ratchet está subido**: las reglas que el preset deja en `warn` para no romper un codebase
// heredado (duplicación, complejidad cognitiva, ciclos de import) están en `error`. Este repo nació
// limpio hoy; dejarlas en `warn` sería estrenar la deuda en vez de evitarla, y un aviso que nadie mira
// es exactamente el gate que no muerde contra el que avisa la doctrina de gates honestos.

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

import antiSlop from "./eslint.anti-slop.mjs";

export default [
  {
    // `.claude/` es código VENDORIZADO del framework (los escáneres del Guardián y sus tests): no es
    // nuestro y no se toca, así que tampoco se lintea con nuestras reglas. Su propio repo lo cubre.
    // Los `.json` no son código: ESLint los parsea como JS y un objeto suelto le parece una expresión
    // sin usar. `tsconfig.test.json` fue el primero que lo destapó.
    //
    // De `web/` se ignora lo GENERADO, no el paquete entero. La primera versión de este arreglo puso
    // `web/**` y el verificador señaló que era demasiado ancho: dejaba los diccionarios, `config.ts`,
    // los tests y los scripts de la web sin linter PARA SIEMPRE, cuando el problema era sólo el
    // directorio que genera `astro sync`. Los `.astro` no los toca ESLint de todas formas (no están en
    // sus extensiones por defecto y su gate es el linter de frontend + `check-astro-sinks`).
    //
    // `web/` es OTRO PAQUETE npm, con su propio gate (`web/npm run gate`: astro check + linter
    // anti-slop de frontend + build + tests). Sin esta entrada, `npm run lint` de la raíz salía 1 en
    // cuanto alguien construía la web: `astro sync` genera `web/.astro/*.d.ts` con `any` y un
    // triple-slash reference, y el ratchet subido del preset los marca como error.
    //
    // Y el CI no lo veía: el job `gate` hace `npm ci` en la raíz y nunca ejecuta Astro, así que
    // `web/.astro/` no existe allí. O sea el espejo de T-168 — allí verde en local e invisible al
    // gate, aquí verde en el gate e imposible en local. Un gate cuyo color depende de si alguien ha
    // corrido un build en OTRO paquete no es un gate. Lo cazó el verificador en RELE-3.
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".claude/**",
      "web/.astro/**",
      "web/dist/**",
      "**/*.json",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: globals.node,
    },
  },
  ...antiSlop,
  {
    // El ratchet, subido. Ver la cabecera.
    rules: {
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-duplicate-string": ["error", { threshold: 5 }],
      "sonarjs/cognitive-complexity": ["error", 15],
      "import/no-cycle": ["error", { maxDepth: 6 }],
    },
  },
  {
    // La misma relajación que trae el preset para código que no es de producción. Va DESPUÉS del
    // ratchet porque en flat config gana el último bloque que casa, y subir las reglas no debe
    // arrastrar a los tests: un test repite literales a propósito, y obligarle a extraer constantes
    // hace el test menos legible sin hacer el código más correcto.
    files: ["tests/**", "scripts/**", "**/*.test.ts", "**/*.config.*"],
    rules: {
      "no-console": "off",
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/cognitive-complexity": "off",
    },
  },
];
