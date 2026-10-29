"""H3 helpers. All topics aggregate to H3 resolution 9 (~175 m edge)."""
import geopandas as gpd
import h3
import pandas as pd
from shapely.geometry import Point, Polygon

RES = 9
SHARD_RES = 6
WGS84 = "EPSG:4326"
METRIC_CRS = "EPSG:32614"


def latlon_to_cell(lat: float, lon: float, res: int = RES) -> str:
    return h3.latlng_to_cell(lat, lon, res)


def cell_centroids(cells) -> gpd.GeoDataFrame:
    cells = list(cells)
    pts = [Point(h3.cell_to_latlng(c)[::-1]) for c in cells]
    return gpd.GeoDataFrame({"h3": cells}, geometry=pts, crs=WGS84)


def cell_polygons(cells) -> gpd.GeoDataFrame:
    cells = list(cells)
    polys = [Polygon([(lon, lat) for lat, lon in h3.cell_to_boundary(c)]) for c in cells]
    return gpd.GeoDataFrame({"h3": cells}, geometry=polys, crs=WGS84)


def points_to_cells(gdf: gpd.GeoDataFrame, res: int = RES) -> pd.Series:
    """H3 cell for each point geometry (any CRS)."""
    g = gdf.to_crs(WGS84).geometry
    return pd.Series([h3.latlng_to_cell(p.y, p.x, res) for p in g], index=gdf.index, name="h3")


def polygons_to_cells(polys: gpd.GeoDataFrame, grid: gpd.GeoDataFrame, columns: list[str]) -> pd.DataFrame:
    """Assign polygon attributes to each grid cell whose centroid falls inside the polygon."""
    joined = gpd.sjoin(grid[["h3", "geometry"]], polys.to_crs(WGS84)[columns + ["geometry"]], how="left", predicate="within")
    return joined.drop_duplicates("h3")[["h3"] + columns].reset_index(drop=True)


def count_within(points: gpd.GeoDataFrame, grid: gpd.GeoDataFrame, radius_m: float) -> pd.Series:
    """Number of points within radius_m of each grid cell centroid."""
    g = grid.to_crs(METRIC_CRS).copy()
    g["geometry"] = g.geometry.buffer(radius_m)
    p = points.to_crs(METRIC_CRS)[["geometry"]]
    joined = gpd.sjoin(g[["h3", "geometry"]], p, how="left", predicate="contains")
    counts = joined.groupby("h3")["index_right"].count()
    return grid["h3"].map(counts).fillna(0).astype(int)


def nearest_distance_m(points: gpd.GeoDataFrame, grid: gpd.GeoDataFrame) -> pd.Series:
    """Straight-line distance in meters from each cell centroid to the nearest point."""
    g = grid.to_crs(METRIC_CRS)[["h3", "geometry"]]
    p = points.to_crs(METRIC_CRS)[["geometry"]]
    joined = gpd.sjoin_nearest(g, p, how="left", distance_col="dist").drop_duplicates("h3")
    return grid["h3"].map(joined.set_index("h3")["dist"])


def walk_minutes(distance_m: pd.Series, detour: float = 1.3, speed_m_per_min: float = 80.0) -> pd.Series:
    return (distance_m * detour / speed_m_per_min).round().astype("Int64")
