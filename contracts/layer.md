# Capas de mapa

Una capa por tema en `web/public/data/layers/<key>.pmtiles` (o GeoJSON en desarrollo: `fixtures/layers/<key>.geojson`).

- Capas de celda (agua, inundacion, granizo, calor, ruido, vial): polígonos H3 res 9 con propiedades `h3`, `score`, `raw`. El frontend pinta con la rampa del tema (`web/src/topics/<key>.ts` → `color`), opacidad según `1 - score/100`.
- Capas de punto (sismo, servicios, vial hotspots): puntos con `kind`, `name`, y en vial `n`.
- Patrimonio: polígonos de áreas de conservación con `name`.
- Nombre de la source-layer dentro del PMTiles = `<key>`.
