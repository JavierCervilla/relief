# Relevo

**Una cola de micro-tareas de ONGs y de proyectos open source que un voluntario consume desde su propia
sesión de Claude Code.**

Relevo no es un proxy de inferencia. **Nunca** recibe, almacena ni enruta credenciales de Claude, de
ChatGPT ni de ningún modelo. No hay tokens de suscripción en el sistema, y eso no es una política que se
pueda relajar: es el invariante que separa el proyecto de lo que los términos de uso prohíben. Si algún
día el servidor necesitara una clave de modelo para funcionar, el diseño se habría roto.

## Por qué existe

La pregunta de partida era si se puede **ceder parte de tu suscripción** de Claude o ChatGPT a tareas con
impacto social. La respuesta corta es que no: compartir cuota, enrutar peticiones a través de credenciales
de otro o usar tokens de suscripción desde herramientas externas viola los términos de Anthropic y de
OpenAI, y desde 2026 se hace cumplir del lado del servidor. Cualquier arquitectura en la que un tercero
decide qué trabajo se ejecuta con la suscripción de otra persona cae en esa zona, aunque el token nunca
salga de la máquina del voluntario.

Lo que sí es defendible es cambiar la materia prima: **el voluntario elige y ejecuta cada tarea en su
propia sesión**, la revisa, y la envía. La plataforma aporta lo que falta — la cola, la verificación
contra un *gold set* y las métricas. Eso es voluntariado asistido por IA, no donación de cuota, y es uso
personal y ordinario.

## Cómo funciona

```
ONG ──(backlog)──► Relevo (cola) ──MCP──► sesión de Claude Code del VOLUNTARIO
                        ▲                          │
                        │                          ├─ el voluntario LISTA   (list_tasks)
                        │                          ├─ ELIGE y reclama       (claim_task)
                        │                          ├─ trabaja con Claude y LEE el resultado
                        │                          └─ ENVÍA                 (submit_result)
                        │
                        └──(verificación: gold set + revisión de la ONG)────┘
```

Los verbos en mayúsculas los ejecuta **una persona**. No hay bucle, no hay modo desatendido y no lo habrá:
un proceso que vacía la cuota sin intervención es justo el patrón por el que acaban baneadas las cuentas
de los voluntarios. Los límites que lo impiden —3 tareas por sesión, 10 al día, claim que caduca a los 30
minutos— viven en el **código del servidor** y no en la skill, y se sostienen también cuando las llamadas
llegan en paralelo, que es como las emite un agente de verdad.

Un matiz que conviene decir en voz alta mientras sea cierto: **en esta fase el "servidor" es un proceso
en la máquina del propio voluntario**, así que los límites son una barandilla honesta, no una garantía
frente a alguien que quiera saltárselos. El de 10 al día, además, todavía no puede llegar a dispararse:
sin persistencia cada proceso empieza de cero y el tope de sesión salta antes. Lo que hace falta para que
esto sea una garantía —identidad y almacenamiento del lado del servicio— es la fase 2 del
[`ROADMAP.md`](ROADMAP.md), y por eso hasta entonces no se despliega nada público.

## Las cinco tools

| Tool | Qué hace |
|---|---|
| `list_tasks` | Lista tareas disponibles, filtrando por tipo, idioma y organización. Sólo muestra; no reserva nada. |
| `get_task` | Devuelve una tarea entera, con su contenido y su checklist. |
| `claim_task` | Reserva una tarea para ti durante 30 minutos. Idempotente si ya era tuya. |
| `release_task` | Devuelve a la cola una tarea que reclamaste y no vas a hacer. |
| `submit_result` | Envía tu resultado. Exige un claim vivo y tuyo. |

`accepted` / `rejected` los decide la ONG, **fuera** de estas cinco tools: un voluntario no acepta su
propio trabajo.

## Dos vías, y por qué la segunda va con cuidado

Las tareas vienen de **ONGs** y de **proyectos open source**. La segunda vía existe porque un repo tiene
el backlog público y ya escrito, así que no hay que esperar a que nadie firme nada.

Pero abrir esa vía a lo bruto sería ser parte de un problema muy documentado. Un estudio de 2026 sobre
294 repositorios y más de 2 millones de PRs mide lo que llama **«AI-DDoS»**: contribuciones plausibles
pero flojas que desbordan la capacidad de revisión. Dos de cada tres mantenedores, de 800 encuestados, lo
declaran una carga significativa. La asimetría es toda la historia: *se generan diez propuestas en el
tiempo que alguien necesita para verificar una*.

Así que en Relevo el consentimiento **no es una política, es el esquema**. Una tarea sin procedencia
registrada no se rechaza: **no se puede construir**.

| Nivel | Qué autoriza | Hace falta para |
|---|---|---|
| **1 · Opt-in** | Que Relevo saque tareas de este repo (con URL comprobable) o el acuerdo con la ONG | **Todo** |
| **2 · Pre-aprobación** | Que **esta** issue concreta admita ayuda de IA | Sólo `patch` |

Los dos niveles no son una invención nuestra: son la política que Ghostty publicó en enero de 2026,
escrita como tipo en vez de como norma.

## Tipos de tarea

| Tipo | Vía | Qué pide | Cómo se verifica |
|---|---|---|---|
| `translate` | ONG y OSS | Traducir un texto corto respetando un checklist | Checklist + referencia |
| `adapt` | ONG | Reescribir a lectura fácil según una norma | Checklist + validación del colectivo |
| `classify` | ONG y OSS | Etiqueta de un conjunto cerrado, con justificación | **Gold set** — en OSS, el histórico de etiquetas del repo |
| `patch` | **Sólo OSS** | Cambio de código sobre una issue pre-aprobada | El mantenedor, en tu PR |

`classify` es el tipo que produce una **cifra de precisión**, que es lo que convierte el piloto en
evidencia en vez de en una sensación. En la vía OSS sale gratis: las etiquetas que el mantenedor ya puso
son el conjunto de referencia.

`patch` es el único que puede hacer daño, y va con tres frenos que responden a quejas medidas:
**un parche por sesión** (revisar código cuesta una tarde, leer una traducción diez minutos),
**`testedHow` obligatorio** — qué ejecutaste y qué viste, antes y después, porque la queja número uno no
es que el parche sea de IA sino que quien lo mandó no reprodujo el fallo — y una **frase de divulgación**
que redacta el servidor para pegar tal cual. **Relevo nunca abre el PR**: lo abre la persona, con su
cuenta y su nombre.

## El contenido de una tarea es input hostil

El texto de una tarea llega desde el backlog de una ONG y puede venir de cualquier parte, así que se
trata como **datos, nunca como instrucciones**. La skill del voluntario
([`skills/relevo/SKILL.md`](skills/relevo/SKILL.md)) fija las reglas: sin red, sin ficheros externos, sin
credenciales, y el contenido siempre delimitado. El servidor colabora entregándolo en un campo marcado
como no confiable, con las marcas de delimitación neutralizadas.

## Estado

**Esqueleto.** Las cinco tools funcionan contra un store **en memoria** alimentado por fixtures. No hay
persistencia, no hay autenticación y **no se despliega nada público**: un servidor sin auth no sale de
tu máquina. Lo que viene está en [`ROADMAP.md`](ROADMAP.md).

## Uso

```bash
npm install
npm run gate     # typecheck + lint + tests: lo mismo que corre CI
npm run build
```

Para conectarlo a Claude Code como servidor MCP local (stdio):

```bash
claude mcp add relevo -- node /ruta/a/relief/dist/index.js
```

Se puede apuntar a otro juego de tareas con `RELEVO_FIXTURES=/ruta/a/tasks.json`.

## Licencia

AGPL-3.0-or-later. Ver [`LICENSE`](LICENSE).
