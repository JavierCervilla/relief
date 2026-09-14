# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

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
