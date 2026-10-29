"""Calor: temperatura media anual (INEGI, carta 1:1,000,000, serie I) por zona.

Cada zona es un rango de 2 °C ("16-18"); metric_raw es el punto medio del rango.
"""
import pandas as pd

from pipeline.common.context import Context
from pipeline.topics import TopicSpec
from pipeline.topics._riesgo import assign_polygons, load_temperature, warn

TOPIC = TopicSpec(
    key="calor",
    label="Calor",
    unit="°C media anual",
    datasets=["zonas-de-distribucion-de-temperatura-media-anual-en-la-ciudad-de-mexico"],
    higher_is_better=False,
)


def _fmt(v: float) -> str:
    return f"{v:g}"


def compute(ctx: Context) -> pd.DataFrame:
    grid = ctx.grid
    zones = load_temperature(ctx, TOPIC.datasets[0])
    cols = ["t_min", "t_max", "t_mid"]
    if zones is None:
        warn(f"{TOPIC.datasets[0]}: no raw files in {ctx.dataset_dir(TOPIC.datasets[0])}; topic has no data")
        cells = pd.DataFrame({c: float("nan") for c in cols}, index=grid.index)
    else:
        cells = assign_polygons(zones, grid, cols).set_axis(grid.index)[cols].astype(float)

    t = cells["t_mid"]
    city = {"city_min": float(t.min()), "city_max": float(t.max())} if t.notna().any() else {}
    labels = [
        None if pd.isna(m) else f"{_fmt(m)} °C media anual (zona {_fmt(lo)}–{_fmt(hi)} °C)"
        for lo, hi, m in zip(cells["t_min"], cells["t_max"], t)
    ]
    extra = [
        {} if pd.isna(m) else {**city, "range": f"{_fmt(lo)}–{_fmt(hi)} °C"}
        for lo, hi, m in zip(cells["t_min"], cells["t_max"], t)
    ]
    return pd.DataFrame({"h3": grid["h3"], "metric_raw": t, "metric_label": labels, "extra": extra})
