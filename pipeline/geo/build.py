"""Base geográfica (D1): malla H3 res 9 de la CDMX con colonia, alcaldía, CP, AGEB y población."""
import json
from pathlib import Path

import geopandas as gpd
import h3
import pandas as pd
import shapely
from shapely.geometry import MultiPolygon, Polygon

from pipeline.common.h3grid import METRIC_CRS, RES, WGS84, cell_polygons
from pipeline.common.paths import PROCESSED_DIR, RAW_DIR, WEB_DATA_DIR

COLONIAS = "catalogo-de-colonias-datos-abiertos"
CODIGOS_POSTALES = "codigos-postales"
AGEB_POB = "caracteristicas-demograficas-de-la-poblacion-ageb-censo-2020"
AGEB_VIV = "caracteristicas-de-las-viviendas-nivel-ageb-censo-2020"

GRID_COLUMNS = ["h3", "lat", "lon", "colonia", "alcaldia", "cp", "ageb", "pop", "poblacion", "viviendas", "land_frac"]


def _polygonal(geom):
    if geom is None or geom.is_empty:
        return None
    if not geom.is_valid:
        geom = shapely.make_valid(geom)
    if isinstance(geom, (Polygon, MultiPolygon)):
        return geom
    parts = [p for p in shapely.get_parts(geom) if isinstance(p, (Polygon, MultiPolygon))]
    return shapely.union_all(parts) if parts else None


def clean(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Reproject to EPSG:4326, repair geometries and drop rows without polygonal geometry."""
    gdf = gdf.to_crs(WGS84) if gdf.crs else gdf.set_crs(WGS84)
    gdf = gdf.set_geometry(gdf.geometry.map(_polygonal))
    return gdf[gdf.geometry.notna()].reset_index(drop=True)


def _read_geojson(raw_dir: Path, dataset_id: str) -> gpd.GeoDataFrame:
    files = sorted((raw_dir / dataset_id).glob("*.json"))
    files = [p for p in files if p.name != "package.json"]
    if not files:
        raise FileNotFoundError(f"no GeoJSON in {raw_dir / dataset_id}; download the data-raw release first")
    return gpd.read_file(files[0])


def load_sources(raw_dir: Path = RAW_DIR) -> dict[str, gpd.GeoDataFrame]:
    colonias = _read_geojson(raw_dir, COLONIAS).rename(columns={"alc": "alcaldia"})
    cps = _read_geojson(raw_dir, CODIGOS_POSTALES).rename(columns={"d_cp": "cp"})
    ageb = _read_geojson(raw_dir, AGEB_POB)[["ageb", "pob", "geometry"]]
    try:
        viv = _read_geojson(raw_dir, AGEB_VIV)[["ageb", "vivtot"]]
        ageb = ageb.merge(viv, on="ageb", how="left")
    except FileNotFoundError:
        ageb["vivtot"] = pd.NA
    return {
        "colonias": clean(colonias[["cve_col", "colonia", "alcaldia", "clasif", "geometry"]]),
        "cps": clean(cps[["cp", "geometry"]]),
        "ageb": clean(ageb),
    }


def land_polygon(*layers: gpd.GeoDataFrame):
    """CDMX land as the union of all source polygons (the CP layer covers the whole entity)."""
    return shapely.union_all([lyr.to_crs(METRIC_CRS).geometry.union_all() for lyr in layers])


def cover_cells(land_metric, res: int = RES) -> gpd.GeoDataFrame:
    """All H3 cells whose hexagon overlaps land, with the land share of each hexagon (EPSG:32614)."""
    buffered = gpd.GeoSeries([land_metric.buffer(400)], crs=METRIC_CRS).to_crs(WGS84).iloc[0]
    cells = sorted(h3.geo_to_cells(buffered, res))
    hexes = cell_polygons(cells).to_crs(METRIC_CRS)
    hex_area = hexes.area
    land_area = hexes.intersection(land_metric).area
    hexes["land_frac"] = (land_area / hex_area).round(4)
    return hexes[hexes["land_frac"] > 0].reset_index(drop=True)


def _largest_overlap(hexes: gpd.GeoDataFrame, polys: gpd.GeoDataFrame, columns: list[str]) -> pd.DataFrame:
    inter = gpd.overlay(hexes[["h3", "geometry"]], polys.to_crs(METRIC_CRS)[columns + ["geometry"]], how="intersection", keep_geom_type=True)
    inter["_a"] = inter.area
    best = inter.sort_values("_a", ascending=False).drop_duplicates("h3")
    return hexes[["h3"]].merge(best[["h3"] + columns], on="h3", how="left")


def apportion(hexes: gpd.GeoDataFrame, polys: gpd.GeoDataFrame, value_cols: list[str]) -> pd.DataFrame:
    """Areal-weighted sum of polygon counts into hexagons (assumes uniform density inside each polygon)."""
    p = polys.to_crs(METRIC_CRS)[value_cols + ["geometry"]].copy()
    p["_total"] = p.area
    inter = gpd.overlay(hexes[["h3", "geometry"]], p, how="intersection", keep_geom_type=True)
    w = inter.area / inter["_total"]
    out = pd.DataFrame({"h3": inter["h3"]})
    for c in value_cols:
        out[c] = pd.to_numeric(inter[c], errors="coerce").fillna(0) * w
    sums = out.groupby("h3")[value_cols].sum()
    return hexes[["h3"]].merge(sums, left_on="h3", right_index=True, how="left").fillna({c: 0 for c in value_cols})


def build_grid(colonias: gpd.GeoDataFrame, cps: gpd.GeoDataFrame, ageb: gpd.GeoDataFrame, res: int = RES) -> pd.DataFrame:
    hexes = cover_cells(land_polygon(colonias, cps, ageb), res)
    col = _largest_overlap(hexes, colonias, ["colonia", "alcaldia"])
    cp = _largest_overlap(hexes, cps, ["cp"])
    ag = _largest_overlap(hexes, ageb, ["ageb"])
    pop = apportion(hexes, ageb, ["pob", "vivtot"])

    grid = hexes[["h3", "land_frac"]].merge(col, on="h3").merge(cp, on="h3").merge(ag, on="h3").merge(pop, on="h3")

    # Cells outside the colonia catalog (rural south): alcaldía of the nearest colonia.
    missing = grid["alcaldia"].isna()
    if missing.any():
        cents = hexes.set_index("h3").loc[grid.loc[missing, "h3"]].centroid
        pts = gpd.GeoDataFrame({"h3": cents.index}, geometry=cents.values, crs=METRIC_CRS)
        near = gpd.sjoin_nearest(pts, colonias.to_crs(METRIC_CRS)[["alcaldia", "geometry"]], how="left").drop_duplicates("h3")
        grid.loc[missing, "alcaldia"] = grid.loc[missing, "h3"].map(near.set_index("h3")["alcaldia"]).values

    latlon = [h3.cell_to_latlng(c) for c in grid["h3"]]
    grid["lat"] = [round(a, 6) for a, _ in latlon]
    grid["lon"] = [round(b, 6) for _, b in latlon]
    grid["pop"] = grid["pob"].round(1)
    grid["poblacion"] = grid["pop"]
    grid["viviendas"] = grid["vivtot"].round(1)
    return grid[GRID_COLUMNS].sort_values("h3").reset_index(drop=True)


def colonias_table(colonias: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    out = colonias.copy()
    out["label"] = out["colonia"] + ", " + out["alcaldia"]
    return out[["cve_col", "colonia", "alcaldia", "clasif", "label", "geometry"]]


def search_index(colonias: gpd.GeoDataFrame, cps: gpd.GeoDataFrame) -> list[dict]:
    """[{type, label, lat, lon}] for the frontend search; one entry per colonia name+alcaldía and per CP."""
    entries = []
    col = colonias.dissolve(by=["colonia", "alcaldia"], as_index=False)
    for t, label, geoms in [("colonia", col["colonia"] + ", " + col["alcaldia"], col.geometry), ("cp", cps.dissolve(by="cp", as_index=False)["cp"], cps.dissolve(by="cp", as_index=False).geometry)]:
        pts = geoms.representative_point()
        entries += [{"type": t, "label": lbl, "lat": round(p.y, 6), "lon": round(p.x, 6)} for lbl, p in zip(label, pts)]
    return sorted(entries, key=lambda e: (e["type"], e["label"]))


def run(raw_dir: Path = RAW_DIR, processed_dir: Path = PROCESSED_DIR, web_data_dir: Path = WEB_DATA_DIR) -> pd.DataFrame:
    src = load_sources(raw_dir)
    grid = build_grid(src["colonias"], src["cps"], src["ageb"])
    out = processed_dir / "geo"
    out.mkdir(parents=True, exist_ok=True)
    grid.to_parquet(out / "grid.parquet", index=False)
    colonias_table(src["colonias"]).to_parquet(out / "colonias.parquet", index=False)
    idx = web_data_dir / "search" / "index.json"
    idx.parent.mkdir(parents=True, exist_ok=True)
    idx.write_text(json.dumps(search_index(src["colonias"], src["cps"]), ensure_ascii=False, separators=(",", ":")))
    return grid
