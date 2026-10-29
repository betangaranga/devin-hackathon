# Temas y campos `extra`

Llaves de tema (iguales en `pipeline/topics/<key>.py` y `web/src/topics/<key>.ts`). Score: 0–100, más alto = mejor.

| key | owner | metric_raw (unidad) | higher_is_better | extra |
|---|---|---|---|---|
| agua | D2 | reportes de falta de agua por 1,000 hab., 12 meses | false | `monthly: number[12]` (por 1,000 hab.), `city_monthly: number[12]` |
| inundacion | D3 | nivel de peligro 1–4 (Atlas, precipitación) | false | `level_label: str` |
| granizo | D3 | nivel de peligro 1–4 (Atlas, granizo) | false | `level_label: str` |
| calor | D3 | °C media anual | false | `city_min: num`, `city_max: num` |
| sismo | D4 | inmuebles en reconstrucción a < 500 m | false | `nearby: [{name, lat, lon, status}]` (máx. 10) |
| patrimonio | D4 | 1 si dentro de área de conservación, 0 si no (no puntúa) | — | `zone_name: str?`, `catalogados_300m: int` |
| vial | D5 | incidentes viales a < 500 m, 12 meses | false | `monthly: int[12]`, `city_ratio: num`, `hotspots: [{name, lat, lon, n}]` (máx. 3) |
| ruido | D6 | dB día | false | `db_night: num?` |
| servicios | D7 | mediana de minutos a pie a los tipos de servicio | false | `nearest: [{kind, name, minutes, lat, lon}]` |

Etiquetas de estado (frontend): score ≥ 67 Bien, ≥ 34 Regular, si no Atención.
