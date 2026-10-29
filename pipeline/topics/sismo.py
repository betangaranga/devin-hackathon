"""Sismo: inmuebles dañados por el sismo del 19-S-2017 (en atención o reconstrucción) a < 500 m.

Fuentes (Comisión para la Reconstrucción / datos.cdmx.gob.mx):
- inmuebles-en-atencion-...: universo vigente del Plan Integral (CRCM + INVI), prioridad al deduplicar.
- reconstruccion-multifamiliares-cdmx y reconstruccion-viviendas-unifamiliares: archivo histórico.
Un registro histórico a < DEDUP_M de un inmueble del Plan Integral se considera el mismo inmueble.
El portal no publica zonificación geotécnica (zonas sísmicas I/II/III), así que esto es un proxy de daño observado.
"""
import geopandas as gpd
import numpy as np
import pandas as pd

from pipeline.common.context import Context
from pipeline.common.h3grid import METRIC_CRS, WGS84
from pipeline.topics import TopicSpec

ATENCION = "inmuebles-en-atencion-como-parte-del-plan-integral-para-la-reconstruccion"
MULTI = "reconstruccion-multifamiliares-cdmx"
UNI = "reconstruccion-viviendas-unifamiliares"

TOPIC = TopicSpec(
    key="sismo",
    label="Sismo y reconstrucción",
    unit="inmuebles en reconstrucción a < 500 m",
    datasets=[ATENCION, MULTI, UNI],
    higher_is_better=False,
)

RADIUS_M = 500
DEDUP_M = 15
MAX_NEARBY = 10
LAT_RANGE = (19.0, 19.65)
LON_RANGE = (-99.4, -98.9)

APOYO = {"REHABILITACION": "Rehabilitación", "RECONSTRUCCION": "Reconstrucción", "REUBICACION": "Reubicación", "DEMOLICION": "Demolición"}


def fix_coord(values: pd.Series, lo: float, hi: float) -> pd.Series:
    """Parse coordinates and repair ones that lost their decimal point (e.g. -9910252997 -> -99.10252997)."""
    v = pd.to_numeric(values, errors="coerce").astype(float)
    for _ in range(12):
        bad = v.notna() & (v.abs() > max(abs(lo), abs(hi)))
        if not bad.any():
            break
        v[bad] = v[bad] / 10
    return v.where(v.between(lo, hi))


def _read_csv(path) -> pd.DataFrame:
    try:
        return pd.read_csv(path, dtype=str, encoding="utf-8-sig")
    except UnicodeDecodeError:
        return pd.read_csv(path, dtype=str, encoding="latin-1")


def _clean(s: pd.Series) -> pd.Series:
    s = s.fillna("").astype(str).str.strip()
    return s.where(~s.str.upper().isin(["", "S/D", "NAN", "NONE"]), "")


def _address(street: pd.Series, number: pd.Series, colonia: pd.Series) -> pd.Series:
    num = _clean(number).str.replace(r"\.0$", "", regex=True)
    first = (_clean(street).str.title() + " " + num).str.strip()
    col = _clean(colonia).str.title()
    name = np.where((first != "") & (col != ""), first + ", " + col, first + col)
    return pd.Series(name, index=street.index).replace("", "Inmueble sin dirección")


def _status(s: pd.Series, default: str) -> pd.Series:
    s = _clean(s).str.capitalize()
    return s.where(s != "", default)


def _points(df: pd.DataFrame, source: str) -> gpd.GeoDataFrame:
    lat = fix_coord(df["latitud"], *LAT_RANGE)
    lon = fix_coord(df["longitud"], *LON_RANGE)
    out = pd.DataFrame({"name": df["name"], "status": df["status"], "source": source, "lat": lat, "lon": lon})
    out = out.dropna(subset=["lat", "lon"])
    return gpd.GeoDataFrame(out, geometry=gpd.points_from_xy(out["lon"], out["lat"]), crs=WGS84)


def load_atencion(ctx: Context) -> gpd.GeoDataFrame | None:
    files = ctx.dataset_files(ATENCION, ".csv")
    if not files:
        return None
    df = _read_csv(files[0])
    apoyo = _clean(df["tipo_apoyo"]).str.upper().map(APOYO).fillna("Atención")
    estatus = _clean(df["estatus"]).str.lower()
    df["status"] = (apoyo + " " + estatus).str.strip()
    df["name"] = _address(df["calle"], df["numero_exterior"], df["colonia"])
    return _points(df, ATENCION)


def load_multifamiliares(ctx: Context) -> gpd.GeoDataFrame | None:
    files = ctx.dataset_files(MULTI, ".csv")
    if not files:
        return None
    df = _read_csv(files[0])
    df["status"] = _status(df["estatus_general"], "Dañado en 2017")
    df["name"] = _address(df["calle"], df["num_exterior"], df["colonia"])
    return _points(df, MULTI)


def load_unifamiliares(ctx: Context) -> gpd.GeoDataFrame | None:
    files = ctx.dataset_files(UNI, ".csv")
    if not files:
        return None
    df = _read_csv(files[0])
    df["status"] = _status(df["estatus_obra"], "Dañado en 2017")
    df["name"] = _address(df["calle_inmueble"], df["exterior_inmueble"], df["colonia_inmueble"])
    return _points(df, UNI)


def load_buildings(ctx: Context) -> gpd.GeoDataFrame | None:
    """All damaged buildings in METRIC_CRS, historical records near a Plan Integral record dropped."""
    current = load_atencion(ctx)
    historical = [g for g in (load_multifamiliares(ctx), load_unifamiliares(ctx)) if g is not None and len(g)]
    if current is None and not historical:
        return None
    parts = []
    if current is not None:
        current = current.to_crs(METRIC_CRS)
        parts.append(current)
    for hist in historical:
        hist = hist.to_crs(METRIC_CRS)
        if current is not None and len(current):
            near = gpd.sjoin_nearest(hist[["geometry"]], current[["geometry"]], max_distance=DEDUP_M, how="inner")
            hist = hist.drop(index=near.index.unique())
        parts.append(hist)
    return gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=METRIC_CRS)


def compute(ctx: Context) -> pd.DataFrame:
    grid = ctx.grid
    pts = load_buildings(ctx)
    if pts is None:
        return pd.DataFrame({"h3": grid["h3"], "metric_raw": np.nan, "metric_label": None, "score": pd.NA, "extra": [{} for _ in range(len(grid))]})

    cells = grid[["h3", "geometry"]].to_crs(METRIC_CRS).reset_index(drop=True)
    centers = cells.geometry.copy()
    buffers = cells.assign(geometry=cells.geometry.buffer(RADIUS_M))
    pairs = gpd.sjoin(buffers, pts[["geometry"]], how="inner", predicate="contains")
    pairs = pairs.rename(columns={"index_right": "pt"})[["h3", "pt"]]
    pairs["dist"] = centers.loc[pairs.index].distance(pts.geometry.loc[pairs["pt"]].set_axis(pairs.index), align=False).to_numpy()
    pairs = pairs.sort_values(["h3", "dist"], kind="stable")

    counts = pairs.groupby("h3").size()
    n = grid["h3"].map(counts).fillna(0).astype(int)

    top = pairs.join(pts[["name", "status", "lat", "lon"]], on="pt").drop_duplicates(["h3", "name", "lat", "lon"])
    top = top.groupby("h3").head(MAX_NEARBY)
    nearby = {
        h: [{"name": r.name, "status": r.status, "lat": round(float(r.lat), 6), "lon": round(float(r.lon), 6)} for r in g.itertuples(index=False)]
        for h, g in top.groupby("h3")
    }
    return pd.DataFrame({
        "h3": grid["h3"].to_numpy(),
        "metric_raw": n.astype(float).to_numpy(),
        "metric_label": [f"{v} inmueble" if v == 1 else f"{v} inmuebles" for v in n],
        "extra": [{"nearby": nearby.get(h, [])} for h in grid["h3"]],
    })
