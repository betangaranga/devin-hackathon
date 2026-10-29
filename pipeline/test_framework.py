import json

import geopandas as gpd
import pandas as pd
import pytest
from jsonschema import validate
from shapely.geometry import Point, box

from pipeline.common import h3grid
from pipeline.common.context import Context, load_grid
from pipeline.common.paths import CONTRACTS_DIR, FIXTURES_DIR
from pipeline.common.scoring import percentile_score, status
from pipeline.run import finalize
from pipeline.topics import TopicSpec, discover


@pytest.fixture(scope="module")
def grid():
    return load_grid(use_fixtures=True)


def test_fixture_grid(grid):
    assert len(grid) > 500 and grid["h3"].is_unique
    assert grid.crs.to_string() == "EPSG:4326"


def test_percentile_score_direction():
    s = pd.Series([1.0, 2.0, 3.0, None])
    lower_better = percentile_score(s, higher_is_better=False)
    higher_better = percentile_score(s, higher_is_better=True)
    assert lower_better[0] > lower_better[2]
    assert higher_better[2] == 100
    assert pd.isna(lower_better[3])
    assert status(80) == "bien" and status(40) == "regular" and status(10) == "atencion"


def test_spatial_helpers(grid):
    center = grid.iloc[0]
    pts = gpd.GeoDataFrame(geometry=[center.geometry, Point(center.geometry.x + 0.05, center.geometry.y)], crs="EPSG:4326")
    counts = h3grid.count_within(pts, grid, 500)
    assert counts.iloc[0] == 1
    dist = h3grid.nearest_distance_m(pts, grid)
    assert dist.iloc[0] < 1
    assert h3grid.walk_minutes(pd.Series([800.0])).iloc[0] == 13
    polys = gpd.GeoDataFrame({"nivel": [4]}, geometry=[box(-99.2, 19.40, -99.15, 19.43)], crs="EPSG:4326")
    joined = h3grid.polygons_to_cells(polys, grid, ["nivel"])
    assert len(joined) == len(grid) and joined["nivel"].notna().any() and joined["nivel"].isna().any()


def test_finalize_and_topic_contract(grid):
    spec = TopicSpec(key="x", label="X", unit="u")
    df = pd.DataFrame({"h3": grid["h3"], "metric_raw": range(len(grid)), "metric_label": "l", "extra": [{"a": 1}] * len(grid)})
    out = finalize(spec, df)
    schema = json.loads((CONTRACTS_DIR / "topic_output.schema.json").read_text())
    row = out.iloc[0].to_dict()
    row["extra"] = json.loads(row["extra"])
    row["score"] = int(row["score"])
    row["metric_raw"] = float(row["metric_raw"])
    validate(row, schema)


def test_discovered_topics_run_on_fixtures(grid):
    ctx = Context(grid=grid)
    for key, mod in discover().items():
        out = finalize(mod.TOPIC, mod.compute(ctx))
        assert set(out["h3"]) <= set(grid["h3"]), key


def test_fixture_cells_match_schema():
    schema = json.loads((CONTRACTS_DIR / "cell.schema.json").read_text())
    for cell in json.loads((FIXTURES_DIR / "cells.json").read_text()):
        validate(cell, schema)
