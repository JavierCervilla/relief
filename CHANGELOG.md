# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

### Añadido — la landing pública, bilingüe (RELE-3)

`web/`: sitio Astro estático, paquete npm propio para que el build de la web y el del servidor MCP no
se entrelacen. Dos rutas, `/` en castellano y `/en/` en inglés.

Es la pieza que faltaba para poder *empezar* la fase 1 del roadmap: RELE-1 y RELE-2 dieron por supuesto
que alguien diría que sí, y hasta ahora no había ni un sitio al que mandar a esa persona.

- **Diccionario tipado** contra una interfaz escrita a mano, no derivada del castellano: los dos
  idiomas se miden contra lo mismo y a los dos les puede faltar algo. Si falta una clave, no compila.
  Y un test compara las rutas completas de ambos, porque una LISTA más corta —un paso, una fila— sí
  compila.
- **Formulario por `mailto:`** con asunto y cuerpo prerrellenados, distintos por vía y por idioma. La
  dirección vive en `web/src/config.ts` y en ningún otro fichero, comprobado por test.
- **Fuentes auto-alojadas**: 202 KB, sólo el subconjunto `latin`, cinco ficheros versionados. Se midió
  antes: la variable de Newsreader con eje óptico costaba 129 KB para dos pesos que nadie interpola.
- **Paleta OKLCH** con una regla por familia (naranja = acción, petróleo = estructura, arena = papel).

### Añadido — las dos restricciones de honestidad, como gate

No son buenas intenciones en un documento: son tests sobre el **HTML renderizado**, y los tres se han
visto en rojo antes de darlos por buenos.

- Ninguna organización real se nombra. Las que hay en las fixtures del servidor son datos de prueba,
  no socios, y nombrarlas en público sugeriría un respaldo inexistente — el daño exacto que el diseño
  de consentimiento de Relevo intenta evitar.
- Ninguna cifra de actividad. Cada número visible tiene que estar en una lista de permitidos **con su
  motivo escrito**; cualquier otro es, por defecto, una métrica inventada, y no hay ni una tarea
  completada que respalde ninguna.
- Ningún tercero. Ni fuentes, ni analítica, ni CDN — comprobado también sobre el **CSS emitido**, que
  es donde se escondería un `@import` y donde la primera versión del test no miraba.

### Añadido — accesibilidad verificada, no prometida

- **Contraste AA medido por test**: parsea `tokens.css`, convierte cada OKLCH a sRGB y recalcula los
  17 pares que la página pinta. Si alguien retoca un token y rompe la legibilidad, la suite se pone
  roja. Un test que reescribiera los hex verificaría su propia copia.
- **Bifurcación por mejora progresiva**: sin JavaScript las dos fichas se sirven abiertas y los botones
  no se pintan. Un botón que no hace nada es peor que no tenerlo — y es lo que permite que el contenido
  esté siempre en el HTML, para un lector de pantalla y para estos mismos tests.
- Enlace de salto, foco visible con contraste propio, `prefers-reduced-motion` respetado, objetivos
  táctiles de 50-54 px y retícula que se pliega a una columna en móvil.

### Añadido — el gate de frontend muerde en CI

Linter anti-slop **vendorizado** en `.claude/skills/frontend-anti-slop/`. La primera versión lo
invocaba por su ruta en el repo del framework: funcionaba en la sesión del agente, donde los dos repos
están clonados al lado, y habría pasado siempre en CI, donde `relief` se clona solo.

### Seguridad — Astro 5 → 7.3.2, forzado por el gate

El gate de seguridad justificó su existencia el mismo día que se instaló. `astro@^5` resolvía a
5.18.2, dentro del rango afectado por **1 CVE crítica y 1 alta**: XSS por sanitización incompleta de
`</script>` en `define:vars`, XSS por nombres de atributo sin escapar en spread props, SSRF por
cabecera Host en la página de error pre-renderizada, y **RCE por optimización de imagen AVIF**, más
las de `libvips`/`libheif` heredadas por `sharp`. Arreglado subiendo a `astro@7.3.2`.

La subida rompió dos tests, y el motivo importa: comparaban el `href` del `mailto:` **byte a byte**
con el escapado de Astro 5, y Astro 7 escapa `'` como `&#39;`. La página no había cambiado — el
aserto medía el *mecanismo* en vez de la *propiedad*. Ahora se comparan los `href` desescapados: el
enlace que un navegador seguiría de verdad.

`osv-scanner` recursivo ya cubría `web/package-lock.json` (comprobado: 377 paquetes). El `npm audit`
de la escalera, no — corre sólo en la raíz —, así que el job de la web lo ejecuta aparte.

Estado: 54 tests, `astro check` sin errores, anti-slop LIMPIO con 5 excepciones trazadas, escalera de
seguridad LIMPIA y `gate-lint` en verde.

### Añadido — segunda vía: proyectos open source

- **Las tareas pueden venir de proyectos open source**, no sólo de ONGs, con **consentimiento en dos
  niveles**: opt-in del proyecto (URL comprobable) para todo, y pre-aprobación de la issue concreta para
  código. Es la política que Ghostty publicó en enero de 2026, escrita como esquema en vez de como norma:
  una tarea sin procedencia **no se puede construir**.
- **Tipo de tarea `patch`**, sólo desde una fuente open source, con tres frenos que responden a quejas
  medidas de los mantenedores: **un parche por sesión**, **`testedHow` obligatorio** (qué ejecutaste y
  qué viste, antes y después) y una **frase de divulgación** que redacta el servidor para pegar tal cual.
  Relevo **nunca** abre el PR: lo abre la persona.
- **Filtro por vía** en `list_tasks` (`sourceKind`), porque «clasificar» ahora puede ser triar issues o
  cribar estudios clínicos y no es lo mismo para quien elige en qué gasta su rato.

### Cambiado

- **Contrato de tarea (incompatible)**: `org: string` desaparece en favor de `source`, que declara la
  procedencia y el permiso. También la vía ONG tiene que nombrar ahora su acuerdo, que hasta ahora era
  implícito. Un campo opcional de consentimiento es un consentimiento que se olvida.

### Corregido

- **Bypass de la cuota por concurrencia.** Comprobar el límite y guardar el claim eran dos pasos con
  cuatro `await` en medio: seis `claim_task` simultáneos se llevaban seis tareas con un tope de tres, y
  la misma ventana rompía la unicidad del claim y admitía envíos duplicados. Reproducido contra el
  binario publicado por el rol `seguridad`. La decisión pasa a ser **una sola operación del store**, sin
  punto de suspensión entre comprobar y escribir; la implementación contra Postgres usará una
  transacción para lo mismo.
- **Un gate de seguridad que podía ir verde sin escanear.** `security-gate.sh` falla abierto por diseño:
  si una herramienta falta, omite su peldaño y sale 0. `pipx install` puede salir 0 sin dejar el binario
  en el PATH, así que el job daba verde con el SAST sin correr. CI comprueba ahora que gitleaks, semgrep
  y osv-scanner están de verdad antes de correr la escalera.
- **Una anotación MCP que mentía.** `list_tasks` y `get_task` se anunciaban con `readOnlyHint: true` y
  devuelven a la cola los claims caducados, o sea escriben.

### Añadido

- **Esqueleto del servidor MCP** con las cinco tools del voluntario — `list_tasks`, `get_task`,
  `claim_task`, `release_task` y `submit_result` — contra un store en memoria alimentado por fixtures.
- **Contrato de tarea en Zod** (`src/schema/task.ts`): `Task` como unión discriminada de `translate`,
  `adapt` y `classify`, más `Claim`, `Submission` y la E/S de cada tool.
- **Interfaz `TaskStore`** con una implementación en memoria. La persistencia futura será otra
  implementación de la misma interfaz, no un rediseño.
- **Límites de cuota en el servidor**: 3 tareas reclamadas por sesión, 10 por voluntario y día, y claims
  que caducan a los 30 minutos. Viven aquí y no en la skill porque una skill se puede editar.
- **Fixtures de las tres ONGs candidatas** (Kiva, Plena Inclusión y Cochrane Crowd), para que "genérico"
  esté validado contra tres flujos y no contra uno.
- **Skill del voluntario** (`skills/relevo/`) en modo pull manual, con las siete reglas fijas.
- **Batería de 22 mutaciones** (`npm run mutate`): rompe cada invariante a propósito y comprueba que los
  tests lo cazan. Una suite en verde no dice nada por sí sola. Ocho de las mutaciones salieron de que el
  `verificador` demostrara agujeros en las catorce primeras: el borde exacto del TTL, la entropía del
  nonce, el conteo por voluntario, el corte de día UTC y la concurrencia no estaban cubiertos.
- **Smoke del binario construido** (`npm run smoke`): arranca `dist/index.js` por stdio y exige que
  anuncie las cinco tools. Cazó que `dist/` compilaba y no arrancaba porque nadie copiaba las fixtures.
- Gates deterministas en CI, los cuatro mordiendo: anti-slop con el ratchet subido a `error`, escalera
  de seguridad sin `--deps-advisory`, `gate-lint` con su `--self-test`, y los escáneres de config del
  agente.
- ROADMAP y **diagrama de arquitectura** (`docs/diagrams/relevo.architecture.{json,html}`), cuya pieza
  central es la arista que **no** existe: ninguna sale de Relevo hacia el modelo.
