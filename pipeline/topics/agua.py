"""Agua (D2): reportes ciudadanos de falta de agua a SACMEX por 1,000 habitantes, por colonia.

Método
- Reportes 2022+ (`reportes-de-agua`, archivo con `fecha_reporte`/`reporte`), solo `reporte == "Falta de agua"`,
  sin duplicados por `id_reporte`. Cada reporte cae en una celda H3 por sus coordenadas y toma la colonia
  que la malla base asigna a esa celda (misma llave colonia+alcaldía que ve el usuario).
- Ventana: los últimos WINDOW_MONTHS meses completos del archivo (se descartan meses finales casi vacíos).
- Población por colonia = suma de `pop` (Censo 2020) de sus celdas. La tasa se suaviza hacia la de la CDMX
  (prior de SHRINK_POP habitantes) para que colonias muy chicas no tengan valores extremos.
- metric_raw = reportes por 1,000 hab. al año; `extra.monthly` son los últimos 12 meses (por 1,000 hab.)
  y `extra.city_monthly` el promedio de la CDMX en los mismos meses.
- Contexto sin puntaje: consumo doméstico promedio (`consumo-agua`, 1er semestre 2019) y metros de red
  secundaria por habitante (`cobertura-de-infraestructura-de-agua-potable-m-hab`).
"""
import logging

import geopandas as gpd
import h3
import numpy as np
import pandas as pd

from pipeline.common.context import Context
from pipeline.common.h3grid import RES, WGS84, polygons_to_cells
from pipeline.topics import TopicSpec

log = logging.getLogger(__name__)

REPORTES = "reportes-de-agua"
CONSUMO = "consumo-agua"
COBERTURA = "cobertura-de-infraestructura-de-agua-potable-m-hab"

TOPIC = TopicSpec(
    key="agua",
    label="Abasto de agua",
    unit="reportes de falta de agua por 1,000 hab. al año",
    datasets=[REPORTES, CONSUMO, COBERTURA],
    higher_is_better=False,
)

WINDOW_MONTHS = 24
SERIES_MONTHS = 12
SHRINK_POP = 2000.0
MIN_COLONIA_POP = 200.0
KEY = ["colonia", "alcaldia"]


def _read_csv(path, **kw) -> pd.DataFrame:
    try:
        return pd.read_csv(path, low_memory=False, **kw)
    except UnicodeDecodeError:
        return pd.read_csv(path, low_memory=False, encoding="latin-1", **kw)


def _header(path) -> list[str]:
    return list(_read_csv(path, nrows=0).columns)


def _to_cells(lat: pd.Series, lon: pd.Series) -> pd.Series:
    lat = pd.to_numeric(lat, errors="coerce")
    lon = pd.to_numeric(lon, errors="coerce")
    ok = lat.between(18.5, 20.5) & lon.between(-100.0, -98.0)
    out = pd.Series(pd.NA, index=lat.index, dtype=object)
    out[ok] = [h3.latlng_to_cell(a, b, RES) for a, b in zip(lat[ok], lon[ok])]
    return out


def load_reports(ctx: Context) -> pd.DataFrame:
    """Falta-de-agua reports (2022+ format): columns h3, month (Period[M])."""
    frames = []
    for path in ctx.dataset_files(REPORTES, ".csv"):
        cols = _header(path)
        if not {"fecha_reporte", "reporte", "latitud", "longitud"} <= set(cols):
            continue
        use = [c for c in ["id_reporte", "fecha_reporte", "reporte", "latitud", "longitud"] if c in cols]
        frames.append(_read_csv(path, usecols=use, dtype=str))
    if not frames:
        return pd.DataFrame({"h3": pd.Series(dtype=object), "month": pd.Series(dtype="period[M]")})
    df = pd.concat(frames, ignore_index=True)
    df = df[df["reporte"].str.strip().str.casefold() == "falta de agua"]
    if "id_reporte" in df:
        df = df.drop_duplicates("id_reporte")
    dates = pd.to_datetime(df["fecha_reporte"], errors="coerce")
    out = pd.DataFrame({"h3": _to_cells(df["latitud"], df["longitud"]), "month": dates.dt.to_period("M")})
    return out.dropna().reset_index(drop=True)


def report_window(months: pd.Series, n: int = WINDOW_MONTHS) -> pd.PeriodIndex:
    """Last n months ending at the last month with a meaningful number of reports."""
    counts = months.value_counts().sort_index()
    full = counts[counts >= 0.25 * counts.median()]
    last = full.index.max()
    return pd.period_range(end=last, periods=n, freq="M")


def colonia_rates(reports: pd.DataFrame, grid: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Per colonia: annual rate and monthly series per 1,000 hab. (shrunk to the city rate)."""
    window = report_window(reports["month"])
    series = window[-SERIES_MONTHS:]
    cells = grid[["h3", "pop"] + KEY].dropna(subset=["colonia"])
    pop = cells.groupby(KEY)["pop"].sum()
    rep = reports[reports["month"].isin(window)].merge(cells[["h3"] + KEY], on="h3")
    monthly = rep.groupby(KEY + ["month"]).size().unstack("month").reindex(columns=window).reindex(pop.index).fillna(0)

    city_pop = pop.sum()
    city_month = monthly.sum() / city_pop
    shrunk = (monthly + SHRINK_POP * city_month) / (pop.to_numpy()[:, None] + SHRINK_POP) * 1000
    years = len(window) / 12
    out = pd.DataFrame({
        "pop": pop,
        "reports": monthly.sum(axis=1).astype(int),
        "rate": shrunk.sum(axis=1) / years,
        "monthly": [list(np.round(r, 3)) for r in shrunk[series].to_numpy()],
    })
    out.loc[out["pop"] < MIN_COLONIA_POP, ["rate"]] = np.nan
    city = {
        "rate": float(monthly.to_numpy().sum() / city_pop * 1000 / years),
        "monthly": [round(float(v), 3) for v in city_month[series] * 1000],
        "months": [str(p) for p in series],
        "period": f"{window[0]}/{window[-1]}",
    }
    return out.reset_index(), city


def consumo_por_colonia(ctx: Context, grid: pd.DataFrame) -> tuple[pd.DataFrame, float | None]:
    """Average domestic billed consumption (m³ per toma per bimestre) per colonia, from manzana points."""
    frames = [
        _read_csv(p) for p in ctx.dataset_files(CONSUMO, ".csv")
        if {"consumo_total_dom", "consumo_prom_dom", "latitud", "longitud"} <= set(_header(p))
    ]
    if not frames:
        return pd.DataFrame(columns=KEY + ["consumo"]), None
    df = pd.concat(frames, ignore_index=True)
    df = df.loc[(df["consumo_prom_dom"] > 0) & (df["consumo_total_dom"] > 0), ["consumo_total_dom", "consumo_prom_dom", "latitud", "longitud"]]
    df["tomas"] = df["consumo_total_dom"] / df["consumo_prom_dom"]
    df["h3"] = _to_cells(df["latitud"], df["longitud"])
    df = df.merge(grid[["h3"] + KEY].dropna(subset=["colonia"]), on="h3")
    agg = df.groupby(KEY)[["consumo_total_dom", "tomas"]].sum()
    agg["consumo"] = agg["consumo_total_dom"] / agg["tomas"]
    city = float(df["consumo_total_dom"].sum() / df["tomas"].sum()) if len(df) else None
    return agg[["consumo"]].reset_index(), city


def cobertura_por_celda(ctx: Context, grid: gpd.GeoDataFrame) -> tuple[pd.Series, float | None]:
    """Meters of secondary water network per inhabitant (colonia INE, pob 2010) for each cell."""
    files = ctx.dataset_files(COBERTURA, ".json", ".geojson")
    if not files:
        return pd.Series(np.nan, index=grid.index), None
    polys = gpd.read_file(files[0])
    polys = polys.set_crs(WGS84) if polys.crs is None else polys.to_crs(WGS84)
    polys["m_hab"] = np.where(polys["pob_2010"] > 0, polys["LongInf_m"] / polys["pob_2010"].where(polys["pob_2010"] > 0), np.nan)
    joined = polygons_to_cells(polys[["m_hab", "geometry"]], grid, ["m_hab"])
    ok = polys["pob_2010"] > 0
    city = float(polys.loc[ok, "LongInf_m"].sum() / polys.loc[ok, "pob_2010"].sum()) if ok.any() else None
    return grid["h3"].map(joined.set_index("h3")["m_hab"]), city


def _r(v, d=2):
    return None if v is None or pd.isna(v) else round(float(v), d)


def compute(ctx: Context) -> pd.DataFrame:
    grid = ctx.grid.copy()
    if "pop" not in grid:
        grid["pop"] = grid.get("poblacion", 0)
    grid["pop"] = pd.to_numeric(grid["pop"], errors="coerce").fillna(0)

    reports = load_reports(ctx)
    if reports.empty:
        log.warning("agua: no %s CSV under %s; topic has no data", REPORTES, ctx.dataset_dir(REPORTES))
        return pd.DataFrame({
            "h3": grid["h3"], "metric_raw": np.nan, "metric_label": None,
            "score": pd.array([pd.NA] * len(grid), dtype="Int64"), "extra": [{} for _ in range(len(grid))],
        })

    rates, city = colonia_rates(reports, grid)
    consumo, city_consumo = consumo_por_colonia(ctx, grid)
    rates = rates.merge(consumo, on=KEY, how="left")
    red, city_red = cobertura_por_celda(ctx, grid)

    cells = grid[["h3"] + KEY].merge(rates, on=KEY, how="left")
    cells["red_m_hab"] = red.to_numpy()

    def extra(row) -> dict:
        if pd.isna(row["rate"]):
            return {}
        return {
            "monthly": row["monthly"],
            "city_monthly": city["monthly"],
            "months": city["months"],
            "period": city["period"],
            "city_rate": _r(city["rate"]),
            "colonia": row["colonia"],
            "reports": int(row["reports"]),
            "colonia_pop": int(round(row["pop"])),
            "consumo_dom_m3_bim": _r(row.get("consumo"), 1),
            "city_consumo_dom_m3_bim": _r(city_consumo, 1),
            "red_m_hab": _r(row["red_m_hab"]),
            "city_red_m_hab": _r(city_red),
        }

    raw = cells["rate"].round(2)
    return pd.DataFrame({
        "h3": cells["h3"],
        "metric_raw": raw,
        "metric_label": raw.map(lambda v: None if pd.isna(v) else f"{v:.1f} reportes / 1,000 hab. al año"),
        "extra": [extra(r) for _, r in cells.iterrows()],
    })
