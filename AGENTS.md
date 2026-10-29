# AGENTS.md

Instrucciones para agentes que trabajan en este repo. El plan completo está en `docs/PLAN.md`.

- Trabaja solo en la carpeta que te asigna `docs/PLAN.md`. Si necesitas cambiar un contrato en `contracts/`, abre un PR aparte y menciónalo.
- No edites listas centrales: los temas se auto-descubren (`pipeline/topics/*.py`, `web/src/topics/*.ts`).
- No intentes descargar de `datos.cdmx.gob.mx`: está bloqueado desde las VMs. Usa el GitHub Release `data-raw-*` o los `fixtures/`.
- No commitees datos crudos ni procesados (`data/raw/`, `data/processed/`). Solo fixtures de menos de 1 MB.
- Coordenadas internas en EPSG:4326; reproyecta al leer. Mide distancias en EPSG:32614 (UTM 14N).
- Puntajes de 0 a 100 donde más alto = mejor, calculados como percentil contra las celdas habitadas de la CDMX.
- Una rama y un PR por tarea. Corre las pruebas de tu carpeta antes de abrir el PR.

## Comandos

```bash
python -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
pytest -q                                   # pruebas del pipeline (incluye contrato de cada tema)
python -m pipeline.run <tema> --fixtures    # corre un tema sobre fixtures/grid.csv
python -m pipeline.build --fixtures         # escribe web/public/data/cells/ desde fixtures/cells.json
cd web && npm ci && npm run lint && npm test && npm run build
```

- Nuevo tema: copia `pipeline/topics/_template.py` a `pipeline/topics/<key>.py`. Las llaves y campos `extra` están en `contracts/topics.md`.
- Datos crudos: `gh release download data-raw-<fecha> -R betangaranga/devin-hackathon -D data/raw` (cuando exista); estructura `data/raw/<id-ckan>/` + `data/raw/index.json`.
