# Roadmap — Relevo

Estado a 2026-09-14. Lo que está marcado está **en `main` y probado**, no "hecho en una rama".

## Fase 0 — Esqueleto (RELE-1) · en curso

- [ ] Contrato de tarea en Zod: `Task`, `Claim`, `Submission` y la E/S de las cinco tools
- [ ] Store en memoria tras la interfaz `TaskStore` (la persistencia será otra implementación, no un rediseño)
- [ ] Las cinco tools MCP: `list_tasks`, `get_task`, `claim_task`, `release_task`, `submit_result`
- [ ] Fixtures de las tres ONGs candidatas (Kiva, Plena Inclusión, Cochrane Crowd)
- [ ] Tests de los cinco invariantes del claim (unicidad, TTL, cuota, submit sobre claim vivo, contenido como dato)
- [ ] Gate anti-slop + gate de seguridad, mordiendo en CI
- [ ] Skill del voluntario (`skills/relevo/`) en modo pull manual
- [ ] Diagrama de arquitectura en `docs/diagrams/`

## Fase 1 — Que una ONG diga que sí

Esta fase **no es de código** y es la que bloquea a las demás. El diseño de la persistencia, del panel y
de la integración no se puede hacer bien antes de saber con quién.

- [ ] Contacto con dos ONGs en paralelo; arrancar con la que responda
- [ ] Adaptar el tipo de tarea a su flujo real (añadir un miembro a la unión es aditivo; rehacer el esquema no)
- [ ] Acordar el gold set: 50 tareas con respuesta de referencia
- [ ] Acordar quién revisa y con qué criterio (`accepted` / `rejected` es suyo, no nuestro)

## Fase 2 — Persistencia y auth

**Bloqueante declarado:** el esqueleto no tiene autenticación, así que hasta que esta fase esté cerrada
**no se despliega nada público**. Sin auth no hay forma de contar la cuota de nadie, y la cuota es lo que
sostiene el argumento de "uso ordinario".

- [ ] Autenticación del voluntario (identidad estable para poder contar sus claims)
- [ ] Postgres + Drizzle: implementación de `TaskStore` contra la DB, con los mismos tests
- [ ] Expiración de claims como trabajo del servidor, no como efecto de la siguiente lectura
- [ ] Ingesta del backlog de la ONG

## Fase 3 — Piloto (8-10 semanas)

- [ ] 300-500 tareas, 20-50 voluntarios, modo pull manual, nada automático
- [ ] Panel de métricas: tareas completadas, precisión contra el gold set, horas humanas ahorradas,
      coste API equivalente y **sesiones por voluntario** (la prueba de uso ordinario)
- [ ] Informe de 5 páginas + testimonio de la ONG

## Fase 4 — Pedir la vía oficial

- [ ] Llevar el informe a Anthropic (vía la ONG partner, Claude for Nonprofits/Goodstack y Beneficial
      Deployments) y a OpenAI
- [ ] Pedir créditos para un pool de API, o una función oficial de "dona un % de tu plan"

## Fuentes de inferencia (intercambiables por diseño)

Las cuatro comparten el contrato de tarea; cambiar de una a otra es una decisión, no una reescritura.

- [x] **Pull manual** — la sesión del voluntario. Es lo que hay hoy.
- [ ] **Pool de créditos API** — Relevo infiere con créditos donados. Cambia quién llama al modelo, no el contrato.
- [ ] **AI Horde / Petals** — GPUs voluntarias con modelos abiertos. Peor calidad, cero dependencia de política.
- [ ] **Función oficial del lab** — el objetivo. Requiere la evidencia de la fase 3.
