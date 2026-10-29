# web — "Antes de rentar"

Frontend del reporte por dirección (ver `../docs/PLAN.md`). Next.js 16 (App Router) + TypeScript + Tailwind + MapLibre GL + PMTiles. Deploy: Vercel.

## Desarrollo

```bash
npm install
npm run dev
```

`npm run dev` / `build` primero corren `scripts/gen-topics-index.mjs`, que genera `src/topics/index.ts` importando todos los `src/topics/*.ts` — los temas se auto-descubren, no hay lista central que editar.

## Estructura (asignación del plan)

| Carpeta | Tarea | Qué va aquí |
|---|---|---|
| `src/app`, `src/components`, `src/profiles.ts` | F1 | shell, tarjetas por tema, barra de percentil, perfiles, comparar |
| `src/map/` | F2 | MapLibre, capas PMTiles por tema, globo, radio de 500 m |
| `src/search`, `src/share`, `src/app/api` | F3 | buscador de dirección, estado en URL, compartir, imagen OG |
| `src/topics/` | todos | un `<tema>.ts` por tema (metadatos + fuente) |
| `src/fixtures/` | dev | celdas de ejemplo mientras no haya pipeline |
| `public/data/cells/` | pipeline | shards JSON por celda H3 res 6 |
| `public/data/layers/` | pipeline | capas `<tema>.pmtiles` |

## Rutas

- `/` — buscador + ejemplos
- `/reporte/[h3]?perfil=&tema=` — reporte de una celda H3 res 9 (estado compartible en la URL)
- `/reporte/[h3]/opengraph-image` — imagen OG dinámica con los puntajes (para WhatsApp/redes)
- `/api/geocode?q=` — proxy de geocodificación (Nominatim por default, MapTiler con `GEOCODER`/`MAPTILER_KEY`)

## Datos

`getCell(h3)` en `src/lib/data.ts` lee `public/data/cells/<res6>.json` si existe y cae a los fixtures si no. Los tipos (`src/lib/types.ts`) siguen el `contracts/cell.schema.json` planeado.

Copia `.env.example` a `.env.local` para cambiar geocodificador o mapa base.
