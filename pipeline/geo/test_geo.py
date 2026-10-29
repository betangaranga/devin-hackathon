import json

import geopandas as gpd
import pandas as pd
import pytest
from jsonschema import validate
from shapely.geometry import Polygon, box

from pipeline.common.h3grid import cell_centroids
from pipeline.common.paths import CONTRACTS_DIR
from pipeline.geo import build
from pipeline.run import finalize
from pipeline.topics import TopicSpec

# Two ~1 km colonias side by side near Del Valle, two CPs splitting them, two AGEBs.
W, S = -99.18, 19.38
D = 0.01


def _gdf(rows, crs="EPSG:4326"):
    return gpd.GeoDataFrame(rows, geometry=[r.pop("geometry") for r in rows], crs=crs)


@pytest.fixture(scope="module")
def sources():
    colonias = _gdf([
        {"cve_col": "014-001", "colonia": "Del Valle Centro", "alcaldia": "Benito Juárez", "clasif": "Colonia", "geometry": box(W, S, W + D, S + D)},
        {"cve_col": "014-002", "colonia": "Narvarte", "alcaldia": "Benito Juárez", "clasif": "Colonia", "geometry": box(W + D, S, W + 2 * D, S + D)},
        # Self-intersecting bow-tie: must be repaired, not dropped.
        {"cve_col": "014-003", "colonia": "Narvarte", "alcaldia": "Benito Juárez", "clasif": "Colonia",
         "geometry": Polygon([(W + D, S + D), (W + 2 * D, S + 1.2 * D), (W + 2 * D, S + D), (W + D, S + 1.2 * D)])},
    ])
    cps = _gdf([
        {"cp": "03100", "geometry": box(W, S, W + D, S + 1.5 * D)},
        {"cp": "03020", "geometry": box(W + D, S, W + 2 * D, S + 1.5 * D)},
    ]).to_crs("EPSG:32614")  # source CRS other than 4326 must be reprojected
    ageb = _gdf([
        {"ageb": "0901400010401", "pob": 4000.0, "vivtot": 1500.0, "geometry": box(W, S, W + D, S + D)},
        {"ageb": "0901400010402", "pob": 2000.0, "vivtot": 800.0, "geometry": box(W + D, S, W + 2 * D, S + D)},
    ])
    return {"colonias": build.clean(colonias), "cps": build.clean(cps), "ageb": build.clean(ageb)}


@pytest.fixture(scope="module")
def grid(sources):
    return build.build_grid(sources["colonias"], sources["cps"], sources["ageb"])


def test_clean_repairs_and_reprojects(sources):
    assert len(sources["colonias"]) == 3 and sources["colonias"].geometry.is_valid.all()
    assert sources["cps"].crs.to_string() == "EPSG:4326"
    assert sources["cps"].total_bounds[0] == pytest.approx(W, abs=1e-6)


def test_grid_columns_and_coverage(grid):
    assert list(grid.columns) == build.GRID_COLUMNS
    assert grid["h3"].is_unique and len(grid) > 25
    assert grid["h3"].str.len().eq(15).all()
    assert grid["land_frac"].between(0, 1, inclusive="right").all()
    assert grid["cp"].notna().all() and set(grid["cp"]) == {"03100", "03020"}
    assert set(grid["colonia"].dropna()) == {"Del Valle Centro", "Narvarte"}
    assert (grid["alcaldia"] == "Benito Juárez").all()  # incl. cells outside colonias (nearest fallback)


def test_population_is_conserved(grid):
    assert grid["pop"].sum() == pytest.approx(6000, rel=1e-3)
    assert grid["viviendas"].sum() == pytest.approx(2300, rel=1e-3)
    assert (grid["pop"] >= 0).all() and grid["poblacion"].equals(grid["pop"])
    west = grid[grid["ageb"] == "0901400010401"]["pop"].mean()
    east = grid[grid["ageb"] == "0901400010402"]["pop"].mean()
    assert west > east  # denser AGEB → more people per cell


def test_attribute_matches_location(grid):
    row = grid.loc[(grid["lon"] - (W + D / 2)).abs().add((grid["lat"] - (S + D / 2)).abs()).idxmin()]
    assert row["colonia"] == "Del Valle Centro" and row["cp"] == "03100" and row["ageb"] == "0901400010401"


def test_search_index(sources):
    idx = build.search_index(sources["colonias"], sources["cps"])
    labels = {(e["type"], e["label"]) for e in idx}
    assert ("colonia", "Del Valle Centro, Benito Juárez") in labels and ("cp", "03100") in labels
    assert len([e for e in idx if e["label"] == "Narvarte, Benito Juárez"]) == 1  # split polygons dissolved
    for e in idx:
        assert set(e) == {"type", "label", "lat", "lon"} and 19 < e["lat"] < 20 and -100 < e["lon"] < -98


def test_run_end_to_end_and_topic_contract(sources, tmp_path):
    raw = tmp_path / "raw"
    for ds, gdf, ren in [
        (build.COLONIAS, sources["colonias"], {"alcaldia": "alc"}),
        (build.CODIGOS_POSTALES, sources["cps"], {"cp": "d_cp"}),
        (build.AGEB_POB, sources["ageb"].drop(columns="vivtot"), {}),
        (build.AGEB_VIV, sources["ageb"].drop(columns="pob"), {}),
    ]:
        (raw / ds).mkdir(parents=True)
        (raw / ds / "package.json").write_text("{}")
        gdf.rename(columns=ren).to_file(raw / ds / "data.json", driver="GeoJSON")
    grid = build.run(raw, tmp_path / "processed", tmp_path / "web")
    stored = pd.read_parquet(tmp_path / "processed" / "geo" / "grid.parquet")
    assert len(stored) == len(grid) and stored["cp"].map(type).eq(str).all()
    assert gpd.read_parquet(tmp_path / "processed" / "geo" / "colonias.parquet").crs.to_epsg() == 4326
    assert json.loads((tmp_path / "web" / "search" / "index.json").read_text())

    # Same merge as pipeline.common.context.load_grid, then a topic built on it validates.
    ctx_grid = cell_centroids(stored["h3"]).merge(stored, on="h3")
    df = pd.DataFrame({"h3": ctx_grid["h3"], "metric_raw": ctx_grid["pop"], "metric_label": "x", "extra": [{}] * len(ctx_grid)})
    out = finalize(TopicSpec(key="x", label="X", unit="u"), df)
    schema = json.loads((CONTRACTS_DIR / "topic_output.schema.json").read_text())
    for row in out.head(20).to_dict("records"):
        row["extra"] = json.loads(row["extra"])
        row["score"] = int(row["score"])
        row["metric_raw"] = float(row["metric_raw"])
        validate(row, schema)
