# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

### Corregido — la ronda del Guardián sobre la landing (4 bloqueantes + 5 de seguridad)

El `verificador` rompió la implementación catorce veces y **seis mutaciones sobrevivieron** con la
suite en 54/54 verde. Dos violaban restricciones que el plan marca como no negociables. Lo que sigue
es lo que hacía falta para que esos verdes significaran algo.

**El oráculo de cifras era una lista blanca de dígitos, y eso no es un veto.** Entre los ordinales
`§1…§5` y los tres topes, la lista acababa admitiendo `0,1,2,3,4,5,10` **estuvieran donde
estuvieran**: «Ya hay 10 organizaciones a bordo y 3 voluntarios activos» pasaba el gate entero. Ahora
el oráculo es **por contexto** — se borran del texto los pocos fragmentos donde una cifra es legítima
(cada tope pegado a su etiqueta, los párrafos del estudio, la licencia, los ordinales) y cualquier
dígito que sobreviva es un intruso. Estrenarlo reclamó dos contextos que nadie había declarado, que es
justo la diferencia.

**Y no miraba dónde había que mirar.** `textoVisible()` borra la etiqueta entera, atributos incluidos,
así que tres cifras colaron por canales que no son el cuerpo del texto: la `meta description` (lo que
enseña un buscador y cualquier tarjeta social), un `aria-label` (lo que oye un lector de pantalla) y
el cuerpo de un `mailto:` (que además viaja percent-encoded y ni casaba con `\d`). Son tres poblaciones
distintas y ahora cada una tiene su regla y **su propio caso de «sabe ponerse rojo»** — el anterior
sólo ejercitaba la única ruta que ya funcionaba.

**El inglés podía perder la frase de honestidad.** `claves()` no dejaba rastro de los elementos
*string* de un array: los arrays de objetos sí, los de cadenas no. Borrar del inglés «no hay
voluntarios activos, ni tareas completadas, ni ninguna organización a bordo» dejaba la suite verde —
literalmente lo que `types.ts` promete que no puede pasar.

**Dos fallos de contraste reales, en estados de interacción.** El borde del botón atenuado daba
**1.26:1** sobre la banda honda (usaba el token de *filete*, no uno de *control*) y el botón dejaba de
leerse como pulsable; el anillo de foco del pie daba **2.39:1** sobre petróleo. Los dos por debajo del
3:1 de WCAG 1.4.11, y los dos invisibles para el test porque `PARES` describía «cada par que la página
pinta» sin incluir ni un estado de interacción: el gate medía su propia población.

**La mejora progresiva no estaba probada, sólo declarada.** El test medía «la cadena está en el
fichero», no «se ve sin JavaScript»: servir las fichas ya plegadas, o borrar la regla que oculta los
botones, dejaba la suite verde con la página rota para quien no ejecuta scripts.

**Accesibilidad:** añadidos `<main>`, `tabindex="-1"` en el destino del enlace de salto (sin él Safari
y VoiceOver no saltan) y `role="list"` en los pasos (`list-style: none` elimina la semántica de lista
en VoiceOver). Fuera los dos `style=` inline, que contradecían la regla que `landing.css` declara
sobre sí mismo.

### Añadido — batería de mutantes para `web/`, con self-test

El paquete nuevo no heredaba una decisión que este repo ya había tomado: una suite verde sin mutantes
no cuenta. **16 mutaciones, todas cazadas**, incluidas las seis que sobrevivieron a la primera ronda.

Estrenarla encontró **cinco supervivientes más** en arreglos que acababan de hacerse: los dos tokens
de contraste podían revertirse al valor malo sin que nada se pusiera rojo (el test medía el token, no
que la hoja lo usara), el aviso del correo podía borrarse en silencio, y —el peor— **el test de
inyección de cabeceras del `mailto:` montaba la URL a mano en vez de llamar a `construirMailto`**:
probaba la cadena del test, no la función. Para arreglarlo la dirección pasa a ser un parámetro con
valor por defecto; sin poder inyectar una envenenada, el invariante era imposible de testear.

### Seguridad — cinco hallazgos de `seguridad`, ninguno bloqueante, todos cerrados

- **Semgrep no tiene lenguaje Astro**: `Landing.astro` no aparecía ni en `scanned` ni en `skipped`, o
  sea que el único fichero del paquete con markup y manipulación del DOM era exactamente el que el SAST
  no miraba, y el peldaño reportaba verde sobre él. Añadido `check-astro-sinks.mjs` como gate
  determinista (visto en rojo). Verde tiene que significar escaneado.
- **`construirMailto` no codificaba la dirección**: con `hola@relevo.org?bcc=x%40evil.tld` —que pasa el
  validador de `config.ts`, porque `%40` no es un `@` literal— salía un BCC funcional en las dos
  llamadas a la acción.
- **Dos pares de fuentes eran el mismo fichero**: Google sirve la misma URL para varios pesos cuando la
  familia es variable. El script la bajaba dos veces con dos nombres. **202 KB → 111,5 KB**, y ahora un
  test compara checksums para que no vuelva a pasar.
- **`startsWith("https://github.com")`** daba por propio `https://github.com.evil.tld`. Es el mismo bug
  que este repo arregló en el consentimiento del servidor, reintroducido en los tests de la web. Ahora
  se compara `URL.hostname`.
- **`sharp` + `libvips` + `libheif` instalados para una página con cero imágenes**, y es justo donde
  vivían las CVE que forzaron la subida a Astro 7. Desactivado el servicio de imagen, que cierra la
  ruta de ejecución. La superficie de *instalación* sigue: `seguridad` probó su propia recomendación
  de `npm ci --omit=optional` antes de dejarla y **rompe el build** — el binding nativo de `rolldown`,
  el bundler de Astro 7, también es opcional. Esa palanca está muerta; queda como riesgo aceptado,
  cubierto por las dos bases de datos de CVE del CI.

Y el aviso público de que el correo es un marcador apunta al repositorio como **el único canal que un
visitante puede verificar por su cuenta**: anunciar que el buzón oficial no está vivo le da munición a
quien registre un dominio parecido y diga «escríbeme aquí mientras tanto».

### Corregido — la batería de mutantes ya no toca el árbol de trabajo

`seguridad` se lo encontró de bruces, no buscándolo: un build suyo salió con
`@import url("https://fonts.googleapis.com/...")` dentro del CSS publicado — el anti-objetivo exacto
que justifica auto-alojar las fuentes. Persiguió la fuga, el fuente estaba limpio, y resultó ser la
**mutación M20** mientras la batería corría en el mismo árbol.

La versión anterior mutaba el fuente de producción in-place y lo restauraba después, con la limpieza
antes de cada `process.exit`. Eso cubre las salidas que el script controla y ninguna más: ni un
SIGKILL, ni un timeout de CI, ni un OOM. Y aunque no se caiga, la ventana existe para cualquier build,
test o **commit** que ocurra dentro. Que la mutación más peligrosa de la batería sea justamente
«reintroduce un origen de terceros en producción» es lo que sube eso de curiosidad a riesgo.

Ahora monta una copia en `/tmp` (enlazando `node_modules`, que es lo que la hace barata) y muta ahí.
El árbol no se toca nunca.

### Corregido — el gate de la raíz se rompía en cuanto alguien construía la web

`npm run lint` de la raíz salía 1 en local y verde en CI. `astro sync` genera `web/.astro/*.d.ts` con
`any`, y el job `gate` hace `npm ci` en la raíz sin ejecutar Astro nunca, así que allí ese directorio no
existe. Un gate cuyo color depende de si alguien ha corrido un build en otro paquete no es un gate.


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
