# Plan: "Antes de rentar"

Reporte por dirección para quien va a rentar o comprar en la CDMX. Cubre inundación, granizo, calor, sismo/reconstrucción, ruido, seguridad vial, agua, patrimonio y servicios a pie. Todo sale de datos abiertos.

Diseño de referencia: [`docs/design/prototipo-dashboard.html`](design/prototipo-dashboard.html). Sus datos son ficticios. Cada tema es una tarjeta, el mapa muestra la capa de calor del tema elegido y el globo sobre el pin da 3 datos clave.

## Arquitectura (sin backend)

```
datos.cdmx.gob.mx (CKAN) ──fetch──▶ data/raw/<dataset>/ (fuera de git, publicado como GitHub Release)
                                      │
                    pipeline/topics/<tema>.py   (un módulo por tema, Python + GeoPandas/DuckDB)
                                      │  métricas por celda H3 res 9 (~175 m) + percentil CDMX
                                      ▼
                    pipeline/build.py ──▶ web/public/data/cells/<h3_res6>.json   (puntajes por celda, en shards)
                                      ──▶ web/public/data/layers/<tema>.pmtiles  (capas del mapa)
                                      ▼
                    web/  (Vite + React + TypeScript + MapLibre GL + PMTiles) → sitio estático
```

- **Unidad espacial:** hexágonos H3 de resolución 9. Una dirección se convierte a celda, y la celda trae los puntajes ya calculados. Así no hay cálculos geoespaciales en tiempo de ejecución.
- **Puntaje:** el percentil de la celda contra todas las celdas habitadas de la CDMX. Entre más alto, mejor. "Patrimonio" es solo informativo y no entra al puntaje. Los pesos por perfil viven en el frontend (`web/src/profiles.ts`).
- **Hosting:** estático (GitHub Pages o Vercel). Los datos procesados se publican como artefactos del build.

## Contratos (fase 0, antes de paralelizar)

Todos los agentes trabajan contra estos contratos. Mientras no haya datos reales, usan los *fixtures*.

| Contrato | Archivo | Qué define |
|---|---|---|
| Manifiesto de datasets | `data/manifest/<tema>.yaml` | id CKAN, recursos, formato, CRS, frecuencia, licencia |
| Salida por tema | `contracts/topic_output.schema.json` | `h3`, `metric_raw`, `metric_label`, `score_0_100`, `extra{}` |
| Celda final | `contracts/cell.schema.json` | puntajes y valores de los 8 temas + patrimonio + servicios cercanos |
| Capa de mapa | `contracts/layer.md` | nombre de la capa PMTiles, propiedades y rampa de color |
| Fixtures | `fixtures/` | 3 direcciones de ejemplo del prototipo, en formato `cell.schema.json` |
| Registro de temas | auto-descubrimiento | `pipeline/topics/*.py` y `web/src/topics/*.ts` se cargan solos, sin lista central que editar |

El auto-descubrimiento evita conflictos de merge: cada agente solo **agrega** archivos en su carpeta.

## Paralelización

```
Fase 0 (secuencial, 1 agente) ─ esqueleto del repo + contratos + fixtures + CI
        │
        ├─ Fase 1A: datos (paralelo)          ├─ Fase 1B: frontend (paralelo, contra fixtures)
        │   D0 fetch + mirror de datasets     │   F1 shell, tarjetas, perfiles, puntaje
        │   D1 base geo (H3, colonias, CP)    │   F2 mapa MapLibre + capas + globo
        │   D2 agua                           │   F3 búsqueda de dirección + compartir + comparar
        │   D3 riesgo: inundación/granizo/calor
        │   D4 sismo + patrimonio
        │   D5 seguridad vial
        │   D6 ruido
        │   D7 servicios a pie
        │
Fase 2 (secuencial) ─ build.py integra temas → cells + PMTiles; datos reales en el frontend
Fase 3 ─ QA de datos (sanity checks por alcaldía), pruebas E2E de UI, deploy
```

### Tareas por agente

Cada agente trabaja en su propia rama, abre su propio PR y solo toca su carpeta.

| Id | Carpeta propia | Datasets (id CKAN) | Entrega | Depende de |
|---|---|---|---|---|
| D0 | `pipeline/fetch/`, `.github/workflows/fetch-data.yml` | todos los manifiestos | cliente CKAN (`package_show` → descarga + checksum), mirror a GitHub Release `data-raw-YYYYMMDD` | fase 0 |
| D1 | `pipeline/geo/` | `catalogo-de-colonias-datos-abiertos`, `codigos-postales`, AGEB Censo 2020, límite CDMX (INEGI Marco Geoestadístico) | malla H3, celda→colonia/CP/AGEB, índice de búsqueda colonia/CP | fase 0 |
| D2 | `pipeline/topics/agua.py` | `reportes-de-agua`, `consumo-agua`, `cobertura-de-infraestructura-de-agua-potable-m-hab` | reportes por 1k hab. a 12 meses, serie mensual vs. CDMX | D1 (usa fixture de colonias mientras tanto) |
| D3 | `pipeline/topics/{inundacion,granizo,calor}.py` | `atlas-de-riesgo-precipitacion`, `atlas-de-riesgo-granizo`, `zonas-de-distribucion-de-temperatura-media-anual-en-la-ciudad-de-mexico` | nivel de peligro 1–4 y °C por celda | fase 0 |
| D4 | `pipeline/topics/{sismo,patrimonio}.py` | `inmuebles-en-atencion-como-parte-del-plan-integral-para-la-reconstruccion`, `reconstruccion-multifamiliares-cdmx`, `reconstruccion-viviendas-unifamiliares`, `areas-de-conservacion-patrimonial`, `inmuebles-catalogados` | inmuebles a < 500 m; dentro o fuera de zona patrimonial | fase 0 |
| D5 | `pipeline/topics/vial.py` | `incidentes-viales-c5`, `hechos-de-transito-reportados-por-ssc-base-comparativa`, `intersecciones-seguras` | incidentes a < 500 m en 12 meses, serie mensual, cruces más peligrosos | fase 0 |
| D6 | `pipeline/topics/ruido.py` | `contaminacion-acustica-en-ciudad-de-mexico` | dB de día y de noche por celda | fase 0 |
| D7 | `pipeline/topics/servicios.py` | `centros-de-salud`, `hospitales-y-centros-de-salud`, `escuelas-publicas`, `mercados-publicos`, `mercados-sobre-ruedas`, `lineas-y-estaciones-del-metro`, Metrobús, Ecobici, `puntos-de-acceso-wifi-en-la-ciudad-de-mexico` | minutos a pie al más cercano de cada tipo | fase 0 |
| F1 | `web/src/{app,components,profiles.ts}` | fixtures | shell, tarjetas por tema, barra de percentil, perfiles, Comparar | fase 0 |
| F2 | `web/src/map/` | fixtures + PMTiles de ejemplo | MapLibre, mapa base, capas de calor por tema, globo de 3 datos, radio de 500 m | fase 0 |
| F3 | `web/src/{search,share}/` | índice de D1 (fixture mientras tanto) | buscador de dirección/colonia/CP, estado en la URL, compartir por WhatsApp, imagen OG | fase 0 |

Definición de terminado para cada tema `Dx`: el módulo lee `data/raw/` (o el fixture), escribe `data/processed/<tema>.parquet` cumpliendo `topic_output.schema.json`, pasa sus pruebas (`pytest pipeline/topics/test_<tema>.py`) y documenta en `data/manifest/<tema>.yaml` el CRS, la columna de fecha y cualquier problema de calidad que encuentre.

## Acceso a los datos

**Hallazgo:** desde las máquinas de Devin (IP en EE. UU., Cognition AI) `datos.cdmx.gob.mx` no responde: hay *timeout* en HTTP, en HTTPS y en la API CKAN. `datos.gob.mx` responde "Access Denied" (Akamai). INEGI y GitHub sí responden. Así que los agentes **no** pueden descargar directo del portal.

Estrategia, en orden:

1. **Mirror una sola vez y todos leen del mirror.** `python3 -m pipeline.fetch` (solo stdlib, cliente CKAN guiado por `data/manifest/*.yaml`) ya está listo. Se corre una vez desde una red que sí llegue al portal, y los archivos crudos se suben como assets de un GitHub Release (`data-raw-YYYYMMDD`). Ahí van los SHP/GeoJSON/CSV con checksum. Los agentes descargan del Release, que sí es alcanzable.
2. **Dónde se corre el fetch** (de menor a mayor esfuerzo):
   - a. ~~GitHub Actions~~: **descartado**. El probe (`data-probe.yml`) también da timeout desde los runners (Azure, centralus). El portal parece bloquear todo lo que no sea de México.
   - b. **Una máquina en México** (por ejemplo, la tuya conectada a la sesión): se corre `python -m pipeline.fetch` y se sube el Release.
   - c. **Proxy o runner en México** si se necesita refresco automático y (a) falla.
3. **Fallbacks por dataset:** INEGI directo para el Marco Geoestadístico y el Censo AGEB (alcanzable), copias en Internet Archive de recursos CKAN (intermitente) y repos públicos en GitHub con copias de algunos datasets (no oficiales; solo para desarrollo).
4. **Nunca se commitean datos crudos a git.** `data/raw/` y `data/processed/` van en `.gitignore`. A git solo entran los fixtures pequeños.

Riesgos que conviene validar primero (son tarea de D0 y D1): que cada dataset del manifiesto siga existiendo, su CRS (muchos SHP de CDMX vienen en UTM 14N, EPSG:32614), la frecuencia real de actualización y la cobertura (por ejemplo, si el atlas de riesgo cubre las 16 alcaldías).

## Decisiones abiertas

- Geocodificación de direcciones: Nominatim/OSM (gratis, con límite de uso), MapTiler o Mapbox (con API key), o solo colonia/CP con el índice local de D1.
- Tiempo a pie: distancia en línea recta × 1.3 (simple) o red peatonal de OSM con OSMnx (más preciso y más trabajo).
- Mapa base: tiles de OpenFreeMap/Protomaps (sin key) o MapTiler.
- Delitos (FGJ): no incluidos por ahora, por el riesgo de estigmatizar colonias.
