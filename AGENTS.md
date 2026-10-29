# AGENTS.md

Instrucciones para agentes que trabajan en este repo. El plan completo está en `docs/PLAN.md`.

- Trabaja solo en la carpeta que te asigna `docs/PLAN.md`. Si necesitas cambiar un contrato en `contracts/`, abre un PR aparte y menciónalo.
- No edites listas centrales: los temas se auto-descubren (`pipeline/topics/*.py`, `web/src/topics/*.ts`).
- No intentes descargar de `datos.cdmx.gob.mx`: está bloqueado desde las VMs. Usa el GitHub Release `data-raw-*` o los `fixtures/`.
- No commitees datos crudos ni procesados (`data/raw/`, `data/processed/`). Solo fixtures de menos de 1 MB.
- Coordenadas internas en EPSG:4326; reproyecta al leer. Mide distancias en EPSG:32614 (UTM 14N).
- Puntajes de 0 a 100 donde más alto = mejor, calculados como percentil contra las celdas habitadas de la CDMX.
- `web/` es Next.js 16 (App Router): `params`/`searchParams` son async. Los docs de la versión instalada están en `web/node_modules/next/dist/docs/`; consúltalos antes de escribir código. Verificación de la carpeta: `npm run lint && npm run build` en `web/`.
- Una rama y un PR por tarea. Corre las pruebas de tu carpeta antes de abrir el PR.
