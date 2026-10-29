"""Shared loaders for D3 topics (inundacion, granizo, calor). Not auto-discovered ('_' prefix).

Atlas de Riesgo CDMX (SPCGIR 2019), capas de peligro por AGEB: the CSV resource carries the
full column names and the polygon as GeoJSON in `geo_shape` (the SHP truncates names and
mangles accents). Each AGEB appears twice in the CSV, so rows are deduplicated by `id`.

Atlas intensity has 5 classes; the product contract uses levels 1-4, so the two top classes
share level 4 (see ATLAS_LEVELS / to_level4). The native 1-5 class is kept for scoring and
in `extra.atlas_level`.
"""
import sys
import unicodedata
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely

from pipeline.common.context import Context
from pipeline.common.h3grid import METRIC_CRS, WGS84, polygons_to_cells
from pipeline.common.scoring import percentile_score

# Atlas `intensidad` -> native class (matches the dataset's own `int2` column).
ATLAS_LEVELS = {"muy bajo": 1, "bajo": 2, "medio": 3, "alto": 4, "muy alto": 5}
ATLAS_TEXT = {1: "muy bajo", 2: "bajo", 3: "medio", 4: "alto", 5: "muy alto"}
# Native class -> contract level 1-4 (Alto and Muy alto collapse to 4).
LEVEL4 = {1: 1, 2: 2, 3: 3, 4: 4, 5: 4}
LEVEL4_TEXT = {1: "muy bajo", 2: "bajo", 3: "medio", 4: "alto"}

# Cells whose centroid falls just outside every polygon (CDMX edge, slivers) take the
# nearest polygon within this distance.
MAX_GAP_M = 500.0


def warn(msg: str) -> None:
    print(f"warning: {msg}", file=sys.stderr)


def _norm(s) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join(s.lower().split())


def read_csv_any(path: Path, **kw) -> pd.DataFrame:
    try:
        return pd.read_csv(path, encoding="utf-8-sig", **kw)
    except UnicodeDecodeError:
        return pd.read_csv(path, encoding="latin-1", **kw)


def assign_polygons(polys: gpd.GeoDataFrame, grid: gpd.GeoDataFrame, columns: list[str], max_gap_m: float = MAX_GAP_M) -> pd.DataFrame:
    """polygons_to_cells (centroid within) + nearest polygon within max_gap_m for unmatched cells.

    Returns one row per grid cell, in grid order, with `h3` + columns (NaN where no polygon).
    """
    polys = polys.to_crs(WGS84)
    out = polygons_to_cells(polys, grid, columns).set_index("h3").reindex(grid["h3"])
    miss = out[columns[0]].isna()
    if miss.any() and len(polys):
        g = grid.loc[grid["h3"].isin(out.index[miss]), ["h3", "geometry"]].to_crs(METRIC_CRS)
        near = gpd.sjoin_nearest(g, polys.to_crs(METRIC_CRS)[columns + ["geometry"]], how="inner", max_distance=max_gap_m)
        near = near.drop_duplicates("h3").set_index("h3")[columns]
        out.loc[near.index, columns] = near.values
    return out.reset_index()


def load_atlas(ctx: Context, dataset_id: str) -> gpd.GeoDataFrame | None:
    """Atlas hazard polygons with `nivel` (native 1-5) and `intens_num`; None if no raw files."""
    files = ctx.dataset_files(dataset_id, ".csv")
    if not files:
        return None
    df = read_csv_any(files[0], dtype={"cvegeo": str, "intens_num": str})
    df = df.drop_duplicates("id") if "id" in df else df.drop_duplicates("geo_shape")
    nivel = df["intensidad"].map(lambda v: ATLAS_LEVELS.get(_norm(v)))
    if "int2" in df:
        nivel = nivel.fillna(pd.to_numeric(df["int2"], errors="coerce"))
    geom = shapely.make_valid(shapely.from_geojson(df["geo_shape"].tolist()))
    gdf = gpd.GeoDataFrame(
        {"nivel": nivel.astype("float"), "intens_num": df.get("intens_num"), "cvegeo": df.get("cvegeo")},
        geometry=geom, crs=WGS84,
    )
    return gdf[gdf["nivel"].between(1, 5)].reset_index(drop=True)


def hazard_topic(ctx: Context, dataset_id: str, intensity_fmt) -> pd.DataFrame:
    """Common compute() for Atlas hazard layers (inundacion, granizo)."""
    grid = ctx.grid
    polys = load_atlas(ctx, dataset_id)
    if polys is None:
        warn(f"{dataset_id}: no raw files in {ctx.dataset_dir(dataset_id)}; topic has no data")
        nivel = pd.Series(float("nan"), index=grid.index)
        intens = pd.Series(None, index=grid.index, dtype=object)
    else:
        cells = assign_polygons(polys, grid, ["nivel", "intens_num"])
        nivel = pd.to_numeric(cells["nivel"], errors="coerce").set_axis(grid.index)
        intens = cells["intens_num"].set_axis(grid.index)

    level4 = nivel.map(LEVEL4).astype("float")
    score = percentile_score(nivel, higher_is_better=False) if nivel.notna().any() else pd.Series(pd.NA, index=grid.index, dtype="Int64")

    def label(n):
        return None if pd.isna(n) else f"Peligro {ATLAS_TEXT[int(n)]}"

    extra = [
        {} if pd.isna(n) else {"level_label": label(n), "atlas_level": int(n), "intensity": intensity_fmt(i)}
        for n, i in zip(nivel, intens)
    ]
    return pd.DataFrame({
        "h3": grid["h3"],
        "metric_raw": level4,
        "metric_label": [None if pd.isna(n) else f"{label(n)} ({int(LEVEL4[int(n)])}/4)" for n in nivel],
        "score": score,
        "extra": extra,
    })


def _first(files: list[Path]) -> Path | None:
    return files[0] if files else None


def load_temperature(ctx: Context, dataset_id: str) -> gpd.GeoDataFrame | None:
    """INEGI 1:1M annual mean temperature zones with `t_min`, `t_max`, `t_mid` (°C)."""
    path = _first(ctx.dataset_files(dataset_id, ".geojson", ".json"))
    if path is not None:
        gdf = gpd.read_file(path)
    else:
        z = _first(ctx.dataset_files(dataset_id, ".zip"))
        if z is None:
            return None
        shp = next((n for n in zipfile.ZipFile(z).namelist() if n.lower().endswith(".shp")), None)
        if shp is None:
            return None
        gdf = gpd.read_file(f"zip://{z}!{shp}")
    if gdf.crs is None:
        gdf = gdf.set_crs(WGS84)
    col = next(c for c in gdf.columns if c.lower() == "rango")
    bounds = gdf[col].astype(str).str.extract(r"(-?\d+(?:\.\d+)?)\s*[-–a]+\s*(-?\d+(?:\.\d+)?)").astype(float)
    gdf = gdf.assign(t_min=bounds[0], t_max=bounds[1])
    gdf["t_mid"] = (gdf["t_min"] + gdf["t_max"]) / 2
    gdf["geometry"] = shapely.make_valid(gdf.geometry.values)
    return gdf[gdf["t_mid"].notna()].to_crs(WGS84).reset_index(drop=True)[["t_min", "t_max", "t_mid", "geometry"]]


__all__ = ["assign_polygons", "hazard_topic", "load_atlas", "load_temperature", "read_csv_any"]
