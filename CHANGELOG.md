# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

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
- **Batería de 14 mutaciones** (`npm run mutate`): rompe cada invariante a propósito y comprueba que
  los tests lo cazan. Una suite en verde no dice nada por sí sola.
- **Smoke del binario construido** (`npm run smoke`): arranca `dist/index.js` por stdio y exige que
  anuncie las cinco tools. Cazó que `dist/` compilaba y no arrancaba porque nadie copiaba las fixtures.
- Gates deterministas en CI, los cuatro mordiendo: anti-slop con el ratchet subido a `error`, escalera
  de seguridad sin `--deps-advisory`, `gate-lint` con su `--self-test`, y los escáneres de config del
  agente.
- ROADMAP y **diagrama de arquitectura** (`docs/diagrams/relevo.architecture.{json,html}`), cuya pieza
  central es la arista que **no** existe: ninguna sale de Relevo hacia el modelo.
