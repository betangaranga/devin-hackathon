# pipeline/geo — base geográfica (D1)

Construye la malla H3 res 9 de la CDMX que usan todos los temas (`Context.grid`) y el índice de búsqueda del frontend.

```bash
mkdir -p data/raw && cd data/raw
for d in catalogo-de-colonias-datos-abiertos codigos-postales \
         caracteristicas-demograficas-de-la-poblacion-ageb-censo-2020 \
         caracteristicas-de-las-viviendas-nivel-ageb-censo-2020; do
  gh release download data-raw-2026-10-29 -R betangaranga/devin-hackathon -p "$d.tar.gz" && tar -xzf "$d.tar.gz"
done
cd ../.. && python -m pipeline.geo
pytest -q pipeline/geo
```

Salidas (no se commitean):

| archivo | contenido |
|---|---|
| `data/processed/geo/grid.parquet` | una fila por celda H3 res 9 que toca tierra de la CDMX: `h3, lat, lon, colonia, alcaldia, cp, ageb, pop, poblacion, viviendas, land_frac` |
| `data/processed/geo/colonias.parquet` | GeoParquet EPSG:4326 del catálogo de colonias: `cve_col, colonia, alcaldia, clasif, label, geometry` |
| `web/public/data/search/index.json` | `[{type: 'colonia'\|'cp', label, lat, lon}]`; colonia = `"Del Valle Centro, Benito Juárez"`, cp = `"03100"` |

Método:

- Tierra de la CDMX = unión de CP ∪ colonias ∪ AGEB (los CP cubren toda la entidad, ~1,491 km²). Se incluyen todas las celdas cuyo hexágono la toca; `land_frac` es la fracción del hexágono dentro de la CDMX.
- `colonia`, `cp`, `ageb`: el polígono con mayor área de intersección con el hexágono (en EPSG:32614). `alcaldia` viene de la colonia; fuera del catálogo (suelo de conservación) se toma de la colonia más cercana.
- `pop` (alias `poblacion`, el nombre del fixture) y `viviendas`: población total y viviendas del Censo 2020 por AGEB, repartidas por área de intersección (densidad uniforme dentro del AGEB). Celdas sin AGEB urbano tienen 0.
- Búsqueda: colonias disueltas por nombre + alcaldía y CP; el punto es `representative_point()` (siempre cae dentro del polígono).

Limitaciones: solo hay AGEB urbanos (≈ 64 mil habitantes rurales de la CDMX no están en la malla); el catálogo de colonias no cubre la zona rural, así que esas celdas tienen `colonia` nula; los nombres de colonia vienen sin acentos ("Villa Coyoacan").
