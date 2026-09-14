# Relevo

**Una cola de micro-tareas de ONGs que un voluntario consume desde su propia sesión de Claude Code.**

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
de los voluntarios. Los límites que lo impiden viven en el **servidor** (3 tareas por sesión, 10 al día,
claim que caduca a los 30 minutos), no en la skill — una skill se puede editar; un invariante testeado no.

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

## Tipos de tarea

El contrato es genérico a propósito — ninguna ONG se ha comprometido todavía y el esquema tiene que
sobrevivir a esa elección. Hay fixtures de las tres candidatas:

| Tipo | Qué pide | Fixture |
|---|---|---|
| `translate` | Traducir un texto corto respetando un checklist de estilo | Kiva — perfiles de préstamo, ~100 palabras |
| `adapt` | Reescribir a lectura fácil según una norma | Plena Inclusión — UNE 153101 |
| `classify` | Etiqueta de un conjunto cerrado, con justificación | Cochrane Crowd — ¿ensayo controlado aleatorizado? |

`classify` es el tipo que produce una **cifra de precisión** contra el gold set, que es lo que convierte
el piloto en evidencia en vez de en una sensación.

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
