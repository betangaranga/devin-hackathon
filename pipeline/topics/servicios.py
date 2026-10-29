"""Servicios a pie: minutes walking (straight line x1.3 at 80 m/min) to the nearest service of each kind."""
import logging
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd

from pipeline.common.context import Context
from pipeline.common.h3grid import METRIC_CRS, WGS84, walk_minutes
from pipeline.topics import TopicSpec

log = logging.getLogger(__name__)

TOPIC = TopicSpec(
    key="servicios",
    label="Servicios a pie",
    unit="min a pie (promedio)",
    datasets=[
        "centros-de-salud",
        "hospitales-y-centros-de-salud",
        "escuelas-publicas",
        "mercados-publicos",
        "mercados-sobre-ruedas",
        "lineas-y-estaciones-del-metro",
        "puntos-de-acceso-wifi-en-la-cdmx",
    ],
    higher_is_better=False,
)

ESSENTIAL = ["salud", "escuela", "mercado", "transporte"]
OPTIONAL = ["wifi"]
CAP_MINUTES = 30
CDMX_BOUNDS = (-99.40, 19.00, -98.90, 19.65)
POINT_COLUMNS = ["kind", "name", "geometry"]


def _clean(value) -> str:
    return " ".join(str(value).split()) if value is not None and not pd.isna(value) else ""


def _read_vector(path: Path, contains: str | None = None) -> gpd.GeoDataFrame:
    """Read a GeoJSON/SHP, or the first matching .shp inside a .zip (skipping __MACOSX)."""
    if path.suffix.lower() != ".zip":
        return gpd.read_file(path)
    with zipfile.ZipFile(path) as z:
        shps = [n for n in z.namelist() if n.lower().endswith(".shp") and "__MACOSX" not in n]
    if contains:
        shps = [n for n in shps if contains.lower() in n.lower()]
    if not shps:
        raise FileNotFoundError(f"no .shp in {path}")
    return gpd.read_file(f"zip://{path}!{shps[0]}")


def _first_vector(ctx: Context, dataset_id: str, contains: str | None = None) -> gpd.GeoDataFrame | None:
    for suffixes in ((".geojson", ".json"), (".zip",), (".shp",)):
        for path in ctx.dataset_files(dataset_id, *suffixes):
            if path.name == "package.json":
                continue
            try:
                gdf = _read_vector(path, contains)
            except Exception as e:  # noqa: BLE001 - try the next file/format
                log.warning("servicios: cannot read %s: %s", path, e)
                continue
            if gdf.geometry.notna().any():
                return gdf
    log.warning("servicios: no geometry for %s", dataset_id)
    return None


def _points(gdf: gpd.GeoDataFrame | None, kind: str, names: pd.Series | None) -> gpd.GeoDataFrame:
    if gdf is None or gdf.empty:
        return gpd.GeoDataFrame(columns=POINT_COLUMNS, geometry="geometry", crs=WGS84)
    gdf = gdf.set_crs(WGS84) if gdf.crs is None else gdf.to_crs(WGS84)
    out = gpd.GeoDataFrame({"kind": kind, "name": names.map(_clean) if names is not None else ""}, geometry=gdf.geometry.values, crs=WGS84)
    out = out[out.geometry.notna() & ~out.geometry.is_empty]
    out["geometry"] = out.geometry.representative_point()
    minx, miny, maxx, maxy = CDMX_BOUNDS
    out = out.cx[minx:maxx, miny:maxy]
    key = pd.DataFrame({"name": out["name"], "x": out.geometry.x.round(5), "y": out.geometry.y.round(5)})
    return out[~key.duplicated()]


def _col(gdf: gpd.GeoDataFrame, *names: str) -> pd.Series | None:
    lower = {c.lower(): c for c in gdf.columns}
    for n in names:
        if n.lower() in lower:
            return gdf[lower[n.lower()]]
    return None


def _from_table(ctx: Context, dataset_id: str) -> gpd.GeoDataFrame | None:
    """Fallback for tabular-only datasets (CSV/XLSX with latitud/longitud columns)."""
    for path in ctx.dataset_files(dataset_id, ".csv", ".xlsx"):
        try:
            if path.suffix.lower() == ".xlsx":
                df = pd.read_excel(path)
            else:
                try:
                    df = pd.read_csv(path, low_memory=False)
                except UnicodeDecodeError:
                    df = pd.read_csv(path, encoding="latin-1", low_memory=False)
        except Exception as e:  # noqa: BLE001
            log.warning("servicios: cannot read %s: %s", path, e)
            continue
        gdf = gpd.GeoDataFrame(df)
        lat, lon = _col(gdf, "latitud", "lat", "latitude", "y"), _col(gdf, "longitud", "lon", "longitude", "x")
        if lat is None or lon is None:
            continue
        lat, lon = pd.to_numeric(lat, errors="coerce"), pd.to_numeric(lon, errors="coerce")
        ok = lat.notna() & lon.notna()
        return gpd.GeoDataFrame(df[ok], geometry=gpd.points_from_xy(lon[ok], lat[ok]), crs=WGS84)
    return None


def load_points(ctx: Context) -> gpd.GeoDataFrame:
    """All service points as (kind, name, geometry) in EPSG:4326."""
    parts = []

    cs = _first_vector(ctx, "centros-de-salud")
    if cs is not None:
        status = _col(cs, "ESTATU_OPE")
        if status is not None:
            cs = cs[~status.fillna("").str.upper().str.startswith("FUERA")]
        parts.append(_points(cs, "salud", _col(cs, "NOM_UNIDAD", "nombre")))
    hosp = _first_vector(ctx, "hospitales-y-centros-de-salud")
    if hosp is not None:
        parts.append(_points(hosp, "salud", _col(hosp, "nombre")))

    esc = _first_vector(ctx, "escuelas-publicas")
    if esc is not None:
        parts.append(_points(esc, "escuela", _col(esc, "nombre")))

    mp = _first_vector(ctx, "mercados-publicos")
    if mp is not None:
        name = _col(mp, "MERCADO", "mercado")
        parts.append(_points(mp, "mercado", "Mercado " + name.map(_clean).str.title() if name is not None else None))
    mr = _first_vector(ctx, "mercados-sobre-ruedas")
    if mr is not None:
        label = pd.Series("Mercado sobre ruedas", index=mr.index)
        ruta, dia = _col(mr, "Ruta"), _col(mr, "Día_Oper", "Dia_Oper")
        if ruta is not None:
            label = label + " " + ruta.map(_clean).str.title()
        if dia is not None:
            label = label + " (" + dia.map(_clean) + ")"
        parts.append(_points(mr, "mercado", label))

    metro = _first_vector(ctx, "lineas-y-estaciones-del-metro", contains="estacion")
    if metro is not None:
        metro = metro[metro.geom_type.isin(["Point", "MultiPoint"])]
        name, line = _col(metro, "NOMBRE", "nombre"), _col(metro, "LINEA", "linea")
        label = "Metro " + name.map(_clean) if name is not None else pd.Series("Metro", index=metro.index)
        if line is not None:
            label = label + " (L" + line.map(_clean).str.lstrip("0") + ")"
        parts.append(_points(metro, "transporte", label))

    wifi = _first_vector(ctx, "puntos-de-acceso-wifi-en-la-cdmx")
    if wifi is None:
        wifi = _from_table(ctx, "puntos-de-acceso-wifi-en-la-cdmx")
    if wifi is not None:
        parts.append(_points(wifi, "wifi", _col(wifi, "nombre", "id", "programa")))

    parts = [p for p in parts if len(p)]
    if not parts:
        return gpd.GeoDataFrame(columns=POINT_COLUMNS, geometry="geometry", crs=WGS84)
    return gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), geometry="geometry", crs=WGS84)


def nearest_by_kind(grid: gpd.GeoDataFrame, points: gpd.GeoDataFrame, kind: str) -> pd.DataFrame:
    """Per grid cell: name, lat, lon and walking minutes to the nearest point of `kind` (empty frame if none)."""
    pts = points[points["kind"] == kind].reset_index(drop=True)
    if pts.empty:
        return pd.DataFrame(index=grid.index, columns=["name", "lat", "lon", "minutes"])
    g = grid[["geometry"]].to_crs(METRIC_CRS)
    p = pts.to_crs(METRIC_CRS)[["geometry"]]
    j = gpd.sjoin_nearest(g, p, how="left", distance_col="dist")
    j = j[~j.index.duplicated(keep="first")].reindex(grid.index)
    idx = j["index_right"].astype(int)
    return pd.DataFrame({
        "name": pts["name"].to_numpy()[idx],
        "lat": pts.geometry.y.to_numpy()[idx].round(6),
        "lon": pts.geometry.x.to_numpy()[idx].round(6),
        "minutes": walk_minutes(j["dist"]),
    }, index=grid.index)


def score_points(grid: gpd.GeoDataFrame, points: gpd.GeoDataFrame) -> pd.DataFrame:
    kinds = [k for k in ESSENTIAL + OPTIONAL if (points["kind"] == k).any()]
    near = {k: nearest_by_kind(grid, points, k) for k in kinds}
    essential = [k for k in ESSENTIAL if k in near]
    if essential:
        capped = pd.concat([near[k]["minutes"].astype(float).clip(upper=CAP_MINUTES) for k in essential], axis=1)
        raw = capped.mean(axis=1).round(1)
    else:
        raw = pd.Series(float("nan"), index=grid.index)

    extras = []
    for i in grid.index:
        nearest = []
        for k in kinds:
            r = near[k].loc[i]
            if pd.isna(r["minutes"]):
                continue
            nearest.append({"kind": k, "name": r["name"] or k, "minutes": int(r["minutes"]), "lat": float(r["lat"]), "lon": float(r["lon"])})
        extras.append({"nearest": nearest})

    return pd.DataFrame({
        "h3": grid["h3"].to_numpy(),
        "metric_raw": raw.to_numpy(),
        "metric_label": [None if pd.isna(v) else f"{v:.0f} min en promedio" for v in raw],
        "extra": extras,
    })


def compute(ctx: Context) -> pd.DataFrame:
    points = load_points(ctx)
    log.info("servicios: %s", points["kind"].value_counts().to_dict())
    return score_points(ctx.grid, points)
