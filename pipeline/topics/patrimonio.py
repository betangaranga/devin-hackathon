"""Patrimonio (informativo, no puntúa): área de conservación patrimonial e inmuebles catalogados cerca.

- areas-de-conservacion-patrimonial (SEDUVI/IPDP): polígonos; la celda está "dentro" si su centroide cae en uno.
- inmuebles-catalogados (SEDUVI): catálogo de inmuebles afectos al patrimonio cultural urbano. Solo cuentan los
  declarados por INBA, INAH o SEDUVI; se excluyen los registros "ACP" (cualquier predio dentro del área) y
  "CC" (colindantes), que no son inmuebles catalogados en sí.
"""
import geopandas as gpd
import numpy as np
import pandas as pd

from pipeline.common.context import Context
from pipeline.common.h3grid import WGS84, count_within, polygons_to_cells
from pipeline.topics import TopicSpec

ZONES = "areas-de-conservacion-patrimonial"
CATALOG = "inmuebles-catalogados"

TOPIC = TopicSpec(
    key="patrimonio",
    label="Patrimonio",
    unit="1 si dentro de área de conservación patrimonial, 0 si no",
    datasets=[ZONES, CATALOG],
    higher_is_better=False,
    scored=False,
)

CATALOG_AGENCIES = r"\b(?:INBA|INAH|SEDUVI)\b"
RADII_M = (300, 200)


def load_zones(ctx: Context) -> gpd.GeoDataFrame | None:
    files = [p for p in ctx.dataset_files(ZONES, ".json", ".geojson") if p.name != "package.json"]
    files = files or ctx.dataset_files(ZONES, ".zip", ".shp")
    if not files:
        return None
    zones = gpd.read_file(files[0])
    zones = zones.set_crs(WGS84) if zones.crs is None else zones.to_crs(WGS84)
    zones["zone_name"] = zones["nombre"].astype(str).str.strip()
    return zones[["zone_name", "geometry"]]


def load_catalog(ctx: Context) -> gpd.GeoDataFrame | None:
    files = ctx.dataset_files(CATALOG, ".csv")
    if not files:
        return None
    try:
        df = pd.read_csv(files[0], dtype=str, encoding="utf-8-sig")
    except UnicodeDecodeError:
        df = pd.read_csv(files[0], dtype=str, encoding="latin-1")
    df = df[df["SP_NOMBRE"].fillna("").str.contains(CATALOG_AGENCIES, regex=True)]
    x, y = pd.to_numeric(df["X"], errors="coerce"), pd.to_numeric(df["Y"], errors="coerce")
    ok = x.between(-99.4, -98.9) & y.between(19.0, 19.65)
    return gpd.GeoDataFrame(geometry=gpd.points_from_xy(x[ok], y[ok]), crs=WGS84)


def compute(ctx: Context) -> pd.DataFrame:
    grid = ctx.grid
    zones, catalog = load_zones(ctx), load_catalog(ctx)
    if zones is None and catalog is None:
        return pd.DataFrame({"h3": grid["h3"], "metric_raw": np.nan, "metric_label": None, "score": pd.NA, "extra": [{} for _ in range(len(grid))]})

    if zones is not None:
        name = grid["h3"].map(polygons_to_cells(zones, grid, ["zone_name"]).set_index("h3")["zone_name"])
        in_zone = name.notna()
        raw = in_zone.astype(float)
    else:
        name, in_zone, raw = pd.Series(None, index=grid.index), pd.Series(False, index=grid.index), pd.Series(np.nan, index=grid.index)

    near = {r: count_within(catalog, grid, r) if catalog is not None else pd.Series(0, index=grid.index) for r in RADII_M}
    labels = [f"Dentro de: {n}" if z else ("Fuera de zona patrimonial" if zones is not None else None) for z, n in zip(in_zone, name)]
    extra = [
        {"in_zone": bool(z), "zone_name": n if z else None, "catalogados_300m": int(c3), "catalogados_200m": int(c2)}
        for z, n, c3, c2 in zip(in_zone, name, near[300], near[200])
    ]
    return pd.DataFrame({"h3": grid["h3"].to_numpy(), "metric_raw": raw.to_numpy(), "metric_label": labels, "extra": extra})
