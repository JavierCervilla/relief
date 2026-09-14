# frontend-anti-slop, vendorizado

El linter y sus tres listas de patrones vienen del framework
(`AgenticFramework/.claude/skills/frontend-anti-slop/`). Aquí hay una **copia**, no un enlace.

## Por qué copiado y no invocado desde el framework

La primera versión del gate de esta web llamaba al script por su ruta en el repo del framework. Eso
funcionaba en la sesión del agente —donde los dos repos están clonados al lado— y **no habría
funcionado en CI**, donde `relief` se clona solo. Un gate que no puede ponerse rojo en CI es teatro:
pasa siempre, y por el motivo equivocado.

## Qué se copió

- `scripts/audit-anti-slop.sh` — el linter, sin cambios.
- `data/banned-{fonts,color-patterns,code-patterns}.txt` — las listas de patrones, sin cambios.

## Cómo se actualiza

A mano, cuando el framework cambie sus listas. Se prefiere el desfase visible a una dependencia de red
en el build: si la lista de aquí se queda corta, el gate protege menos, pero sigue siendo determinista
y reproducible. Si dependiera de otro repo, no sería ni lo uno ni lo otro.
