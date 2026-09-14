# Conectar Relevo a tu Claude Code

## Qué necesitas

Node 22 o superior. Nada más: el esqueleto corre entero en tu máquina, contra las tareas de ejemplo que
vienen en el repo.

## Instalar

```bash
git clone https://github.com/JavierCervilla/relief.git
cd relief
npm install
npm run build
```

## Conectar

```bash
claude mcp add relevo -- node /ruta/absoluta/a/relief/dist/index.js
```

Comprueba que ha quedado conectado:

```bash
claude mcp list
```

Deberías ver `relevo` con sus cinco tools: `list_tasks`, `get_task`, `claim_task`, `release_task` y
`submit_result`.

## Configuración

| Variable | Para qué | Por defecto |
|---|---|---|
| `RELEVO_VOLUNTEER_ID` | Tu identificador de voluntario. Es sobre lo que se cuenta el límite diario. | `local-volunteer` |
| `RELEVO_FIXTURES` | Ruta a otro fichero de tareas, si quieres probar con las tuyas. | Las que trae el repo |

## Qué NO necesita

**Ninguna credencial de modelo.** Relevo no llama a Claude ni a ningún otro modelo: la inferencia ocurre
en tu sesión, con tu suscripción, bajo tu control. Si alguna vez una versión de esto te pide una API key
de un modelo, algo va mal — pregunta antes de dársela.

Tampoco necesita acceso a internet para funcionar con las tareas de ejemplo.

## Estado

Esto es un **esqueleto**. El store es de memoria: al cerrar la sesión se pierden los claims, y las tareas
vuelven a estar todas disponibles. No hay servidor remoto al que conectarse todavía y **no hay
autenticación**, así que no lo expongas en una red. Cuando haya una ONG de verdad en el otro extremo,
esto cambia; está en el `ROADMAP.md` del repo.
