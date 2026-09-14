# Roadmap — Relevo

Estado a 2026-09-14. Una casilla se marca en el **mismo PR** que trae el trabajo, así que marcado quiere
decir *probado y de camino a `main`*, nunca "lo tengo casi".

## Fase 0 — Esqueleto (RELE-1) · completa

- [x] Contrato de tarea en Zod: `Task`, `Claim`, `Submission` y la E/S de las cinco tools
- [x] Store en memoria tras la interfaz `TaskStore` (la persistencia será otra implementación, no un rediseño)
- [x] Las cinco tools MCP: `list_tasks`, `get_task`, `claim_task`, `release_task`, `submit_result`
- [x] Fixtures de las tres ONGs candidatas (Kiva, Plena Inclusión, Cochrane Crowd)
- [x] Tests de los cinco invariantes del claim (unicidad, TTL, cuota, submit sobre claim vivo, contenido como dato)
- [x] Batería de mutaciones: cada invariante visto en rojo, y la batería demostrando que sabe ponerse roja
- [x] Smoke del binario construido (arranca por stdio y anuncia las cinco tools)
- [x] Gate anti-slop + gate de seguridad, mordiendo en CI
- [x] Skill del voluntario (`skills/relevo/`) en modo pull manual
- [x] Diagrama de arquitectura en `docs/diagrams/`

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
- [ ] **Expiración de claims como trabajo del servidor, no como efecto de la siguiente lectura.** Ojo:
      ésta es la única ruta de mutación que NO bajó al store en RELE-1 — la pasada de caducidad tiene
      cuatro `await` en bucle y un read-modify-write sobre tareas. Hoy no es alcanzable (`seguridad`
      barrió 936 configuraciones desde la superficie pública sin un solo daño: con el store en memoria
      ninguna llamada cede de verdad), pero **la ventana existe en el código** y se abre en cuanto el
      borrado tenga latencia real, que es exactamente lo que trae esta casilla. El daño sería pérdida de
      trabajo y cuota quemada —un voluntario traduce media hora y recibe `no_claim` al enviar—, no un
      salto de cuota ni envíos duplicados. La promesa de transacción de `src/store/task-store.ts` cubre
      los tres `try*` y **no** cubre esta pasada: el commit que la haga real tiene que meterla dentro.
- [ ] **Ingesta del backlog de la ONG.** Hoy las tareas son fixtures del repo, revisadas y bajo CI. En
      cuanto entren de fuera, tres cosas que hoy son defendibles dejan de serlo a la vez, así que van
      nombradas aquí y no como deuda difusa (las señalaron `seguridad` y el `verificador` en RELE-1):
  - [ ] **Campos derivados del material.** Sólo `content` va dentro de la valla. `title`,
        `instructions`, `question` y `labels` se renderizan en el marco *confiable* — y los backlogs
        reales derivan campos del propio documento (un título sacado de la primera línea). El arreglo no
        es envolverlos: es que la ingesta separe la provenencia y valide esos campos contra plantilla.
  - [ ] **Codepoints invisibles.** El bloque de etiquetas Unicode (U+E0000) atraviesa la valla intacto:
        el material se entrega como dato y eso sigue funcionando, pero derrota la revisión humana, que
        es la última capa — no se puede leer lo que no se ve. El repo ya vendoriza la lista exacta en
        `check-unicode-safety.mjs`; aplicarla en tiempo de servicio es barato.
  - [ ] **Cota de longitud.** `content`, `instructions`, `title` y la checklist no tienen máximo. Un
        material de 10 MB es una denegación de contexto en la sesión del voluntario.

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
