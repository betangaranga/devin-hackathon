"""D6 ruido: densidad de denuncias de contaminación acústica (PAOT / CentroGeo, kernel 2020).

The dataset has no dB measurements: it is a kernel-density surface of noise complaints
classified into 3 levels (GRIDCODE 0 = < 0.119, 1 = 0.119-1.16, 2 = 1.16-30.47).
metric_raw is the area-weighted mean level (0-2) inside a disc around each cell centroid,
so cells near a high-density zone rank worse than cells in the middle of a quiet one.
Cells whose disc is mostly outside the layer (southern rural CDMX) get null metric/score.
"""
import warnings

import geopandas as gpd
import numpy as np
import pandas as pd

from pipeline.common.context import Context
from pipeline.common.h3grid import METRIC_CRS, WGS84
from pipeline.topics import TopicSpec

DATASET = "contaminacion-acustica-en-ciudad-de-mexico"

TOPIC = TopicSpec(
    key="ruido",
    label="Ruido",
    unit="nivel de denuncias de ruido (0–2)",
    datasets=[DATASET],
    higher_is_better=False,
)

RADIUS_M = 300.0
MIN_COVERAGE = 0.5
LEVEL_LABELS = {0: "Pocas denuncias de ruido", 1: "Denuncias de ruido moderadas", 2: "Muchas denuncias de ruido"}


def load_levels(ctx: Context) -> gpd.GeoDataFrame | None:
    """Kernel polygons with an integer `level` column, in EPSG:4326. None if the raw data is missing."""
    files = ctx.dataset_files(DATASET, ".json", ".geojson") or ctx.dataset_files(DATASET, ".shp")
    if not files:
        warnings.warn(f"ruido: no GeoJSON/SHP in {ctx.dataset_dir(DATASET)}; download the data-raw release. All cells null.")
        return None
    gdf = gpd.read_file(files[0])
    if gdf.crs is None:
        gdf = gdf.set_crs(WGS84)
    gdf = gdf.to_crs(WGS84)
    gdf["level"] = pd.to_numeric(gdf["GRIDCODE"], errors="coerce")
    gdf = gdf[gdf["level"].isin([0, 1, 2]) & gdf.geometry.notna()]
    gdf["geometry"] = gdf.geometry.make_valid()
    return gdf[["level", "geometry"]].reset_index(drop=True)


def cell_levels(levels: gpd.GeoDataFrame, grid: gpd.GeoDataFrame, radius_m: float = RADIUS_M) -> pd.DataFrame:
    """Per cell: area-weighted mean level in a disc, layer coverage of the disc, and level at the centroid."""
    g = grid[["h3", "geometry"]].to_crs(METRIC_CRS)
    discs = gpd.GeoDataFrame({"h3": g["h3"].values}, geometry=g.geometry.buffer(radius_m).values, crs=METRIC_CRS)
    disc_area = np.pi * radius_m**2
    polys = levels.to_crs(METRIC_CRS)
    inter = gpd.overlay(discs, polys, how="intersection", keep_geom_type=True)
    inter["a"] = inter.geometry.area
    inter["la"] = inter["a"] * inter["level"]
    agg = inter.groupby("h3")[["a", "la"]].sum()
    coverage = grid["h3"].map(agg["a"] / disc_area).fillna(0.0).clip(0, 1)
    mean_level = grid["h3"].map(agg["la"] / agg["a"])

    at_centroid = gpd.sjoin(grid[["h3", "geometry"]], levels, how="left", predicate="within")
    at_centroid = at_centroid.sort_values("level", ascending=False).drop_duplicates("h3").set_index("h3")["level"]
    return pd.DataFrame({
        "h3": grid["h3"].values,
        "mean_level": mean_level.values,
        "coverage": coverage.values,
        "centroid_level": grid["h3"].map(at_centroid).values,
    })


def compute(ctx: Context) -> pd.DataFrame:
    grid = ctx.grid
    levels = load_levels(ctx)
    if levels is None:
        levels = gpd.GeoDataFrame({"level": []}, geometry=[], crs=WGS84)
    cl = cell_levels(levels, grid)
    ok = cl["coverage"] >= MIN_COVERAGE
    raw = cl["mean_level"].where(ok).round(2)
    level = cl["centroid_level"].where(ok)
    level = level.fillna(raw.round()).where(raw.notna())
    labels = [LEVEL_LABELS[int(v)] if pd.notna(v) else None for v in level]
    extra = [
        {"level": int(lv) if pd.notna(lv) else None, "level_label": lab, "db_night": None}
        for lv, lab in zip(level, labels)
    ]
    return pd.DataFrame({
        "h3": grid["h3"].values,
        "metric_raw": raw.astype(float).values,
        "metric_label": pd.Series(labels, dtype=object).values,
        "extra": extra,
    })
