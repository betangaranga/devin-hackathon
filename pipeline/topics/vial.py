"""Seguridad vial (D5): incidentes viales reportados al C5 a < 500 m de cada celda.

- Fuente principal: `incidentes-viales-c5` (CSV multi-año, se lee con DuckDB). Solo código de cierre
  "A" (afirmativo: una unidad llegó y confirmó la emergencia); se excluyen N, I, F y D (negativos,
  solicitudes de información, falsos y duplicados). Son reportes atendidos, no hechos confirmados por peritaje.
- Ventana: los últimos 3 años calendario completos (12 meses con datos) presentes en los archivos.
- metric_raw: promedio anual de incidentes a < 500 m del centroide de la celda (sin ponderar).
- score: percentil del promedio anual ponderado por gravedad (sin lesionados 1, con lesionados 2,
  con fallecidos 5), menos incidentes = mejor.
- Hotspots: incidentes agrupados en hexágonos H3 res 10 (~65 m); nombre del cruce tomado de
  `intersecciones-seguras` (SEMOVI) o de `hechos-de-transito-reportados-por-ssc-base-comparativa`
  (punto_1 y punto_2) si hay uno a < 75 m; si no, "Cerca de <colonia>".
"""
import duckdb
import h3
import numpy as np
import pandas as pd
from pyproj import Transformer
from shapely import STRtree, points

from pipeline.common.context import Context
from pipeline.common.h3grid import METRIC_CRS, WGS84
from pipeline.topics import TopicSpec

C5 = "incidentes-viales-c5"
SSC = "hechos-de-transito-reportados-por-ssc-base-comparativa"
SAFE = "intersecciones-seguras"

TOPIC = TopicSpec(
    key="vial",
    label="Seguridad vial",
    unit="incidentes viales a < 500 m, 12 meses",
    datasets=[C5, SSC, SAFE],
    higher_is_better=False,
)

RADIUS_M = 500
N_YEARS = 3
HOTSPOT_RES = 10
HOTSPOT_MIN = 3
NAME_RADIUS_M = 75
W_PLAIN, W_INJURY, W_FATAL = 1, 2, 5
BBOX = (-99.40, 19.04, -98.90, 19.65)

_to_metric = Transformer.from_crs(WGS84, METRIC_CRS, always_xy=True)


def _metric_points(lon, lat):
    x, y = _to_metric.transform(np.asarray(lon, float), np.asarray(lat, float))
    return points(np.column_stack([x, y]))


def load_c5(ctx: Context) -> pd.DataFrame:
    """Confirmed (código A) C5 incidents: date, lat, lon, weight, colonia."""
    files = ctx.dataset_files(C5, ".csv")
    if not files:
        raise FileNotFoundError(f"no CSV files for {C5} in {ctx.dataset_dir(C5)}")
    paths = ", ".join(f"'{p.as_posix()}'" for p in files)
    sql = f"""
        select try_cast(fecha_creacion as date) as fecha,
               try_cast(latitud as double) as lat, try_cast(longitud as double) as lon,
               case when tipo_incidente_c4 = 'Cadáver' then {W_FATAL}
                    when tipo_incidente_c4 = 'Lesionado'
                      or regexp_matches(lower(incidente_c4), 'con lesionad|atropellad|prensad') then {W_INJURY}
                    else {W_PLAIN} end as weight,
               nullif(colonia_catalogo, 'NA') as colonia
        from read_csv([{paths}], all_varchar = true, union_by_name = true, header = true)
        where codigo_cierre = 'A'
    """
    df = duckdb.sql(sql).df().dropna(subset=["fecha", "lat", "lon"])
    lo_x, lo_y, hi_x, hi_y = BBOX
    df = df[df.lon.between(lo_x, hi_x) & df.lat.between(lo_y, hi_y)].copy()
    df["fecha"] = pd.to_datetime(df["fecha"])
    df["year"] = df.fecha.dt.year
    df["month"] = df.fecha.dt.month
    return df.reset_index(drop=True)


def full_years(df: pd.DataFrame, n: int = N_YEARS) -> list[int]:
    months = df.groupby("year")["month"].nunique()
    years = sorted(months[months == 12].index)[-n:]
    if not years:
        raise ValueError("no full calendar year in C5 data")
    return [int(y) for y in years]


def _load_names(ctx: Context) -> pd.DataFrame:
    frames = []
    safe = ctx.dataset_files(SAFE, ".csv")
    if safe:
        s = pd.read_csv(safe[0])
        frames.append(pd.DataFrame({"name": s["interseccion"].str.strip(), "lat": s["latitud"], "lon": s["longitud"], "prio": 0}))
    ssc = ctx.dataset_files(SSC, ".csv")
    if ssc:
        s = pd.read_csv(ssc[0], usecols=["punto_1", "punto_2", "coordenada_x", "coordenada_y"], dtype=str)
        s = s.dropna(subset=["punto_1", "punto_2"])
        name = s["punto_1"].str.strip().str.title() + " y " + s["punto_2"].str.strip().str.title()
        frames.append(pd.DataFrame({"name": name, "lat": pd.to_numeric(s["coordenada_y"], errors="coerce"),
                                    "lon": pd.to_numeric(s["coordenada_x"], errors="coerce"), "prio": 1}))
    if not frames:
        return pd.DataFrame(columns=["name", "lat", "lon", "prio"])
    return pd.concat(frames, ignore_index=True).dropna()


def _hotspots(inc: pd.DataFrame, n_years: int, ctx: Context) -> pd.DataFrame:
    inc = inc.assign(cl=[h3.latlng_to_cell(a, b, HOTSPOT_RES) for a, b in zip(inc.lat, inc.lon)])
    cl = inc.groupby("cl").agg(n=("lat", "size"), lat=("lat", "mean"), lon=("lon", "mean"),
                               colonia=("colonia", lambda s: s.mode().iat[0] if s.notna().any() else None))
    cl = cl[cl.n >= HOTSPOT_MIN].reset_index(drop=True)
    cl["n"] = (cl.n / n_years).round().astype(int)
    cl["name"] = cl.colonia.map(lambda c: f"Cerca de {c}" if c else "Cruce sin nombre")
    names = _load_names(ctx)
    if len(names) and len(cl):
        geo = _metric_points(cl.lon, cl.lat)
        for prio in sorted(names.prio.unique(), reverse=True):  # SSC first, SEMOVI overrides
            nm = names[names.prio == prio].reset_index(drop=True)
            tree = STRtree(_metric_points(nm.lon, nm.lat))
            idx, hit = tree.query_nearest(geo, max_distance=NAME_RADIUS_M)
            cl.loc[idx, "name"] = nm.name.values[hit]
    return cl


def inhabited_percentile(values: np.ndarray, inhabited: np.ndarray) -> pd.Series:
    """0-100, lower values = higher score, ranked against inhabited cells only (mid-rank for ties)."""
    ref = np.sort(values[inhabited]) if inhabited.any() else np.sort(values)
    below = np.searchsorted(ref, values, side="left")
    equal = np.searchsorted(ref, values, side="right") - below
    share = (below + 0.5 * equal) / len(ref)
    return pd.Series(np.round((1 - share) * 100), dtype="Int64")


def compute(ctx: Context) -> pd.DataFrame:
    grid = ctx.grid.reset_index(drop=True)
    all_inc = load_c5(ctx)
    years = full_years(all_inc)
    inc = all_inc[all_inc.year.isin(years)].reset_index(drop=True)
    n_years = len(years)
    last = years[-1]

    centers = _metric_points(grid.geometry.x, grid.geometry.y)
    tree = STRtree(_metric_points(inc.lon, inc.lat))
    gi, pi = tree.query(centers, predicate="dwithin", distance=RADIUS_M)

    n = len(grid)
    count = np.bincount(gi, minlength=n) / n_years
    weighted = np.bincount(gi, weights=inc.weight.values[pi], minlength=n) / n_years
    in_last = (inc.year.values[pi] == last)
    monthly = np.zeros((n, 12), dtype=int)
    np.add.at(monthly, (gi[in_last], inc.month.values[pi][in_last] - 1), 1)

    inhabited = grid["poblacion"] > 0 if "poblacion" in grid else pd.Series(True, index=grid.index)
    city_mean = count[inhabited.values].mean() if inhabited.any() else count.mean()
    ratio = count / city_mean if city_mean > 0 else np.zeros(n)

    cl = _hotspots(inc, n_years, ctx)
    hot = [[] for _ in range(n)]
    if len(cl):
        hg, hc = STRtree(_metric_points(cl.lon, cl.lat)).query(centers, predicate="dwithin", distance=RADIUS_M)
        pairs = pd.DataFrame({"g": hg, "n": cl.n.values[hc], "c": hc}).sort_values(["g", "n"], ascending=[True, False])
        for g, sub in pairs.groupby("g", sort=False):
            hot[g] = [{"name": cl.name.iat[c], "lat": round(float(cl.lat.iat[c]), 6),
                       "lon": round(float(cl.lon.iat[c]), 6), "n": int(cl.n.iat[c])}
                      for c in sub.c.values[:3]]

    period = f"{years[0]}–{years[-1]}"
    extra = [{"monthly": monthly[i].tolist(), "city_ratio": round(float(ratio[i]), 2), "hotspots": hot[i],
              "weighted": round(float(weighted[i]), 1), "period": period, "monthly_year": last}
             for i in range(n)]
    raw = pd.Series(count.round(1), index=grid.index)
    return pd.DataFrame({
        "h3": grid["h3"],
        "metric_raw": raw,
        "metric_label": raw.map(lambda v: f"{v:,.0f} incidentes/año"),
        "score": inhabited_percentile(weighted, inhabited.values),
        "extra": extra,
    })
