import json

import geopandas as gpd
import h3
import pandas as pd
import pytest
from jsonschema import validate
from shapely.geometry import box

from pipeline.common.context import Context
from pipeline.common.h3grid import cell_centroids
from pipeline.common.paths import CONTRACTS_DIR
from pipeline.run import finalize
from pipeline.topics import ruido

LAT, LON = 19.40, -99.15


@pytest.fixture
def grid():
    cells = sorted(h3.grid_disk(h3.latlng_to_cell(LAT, LON, 9), 12))
    return cell_centroids(cells)


def _layer():
    """Three vertical bands (level 2 | 1 | 0) west of LON + 0.02; nothing east of it."""
    return gpd.GeoDataFrame(
        {"ID": [1, 2, 3], "GRIDCODE": [2, 1, 0], "Valores": ["1.16 - 30.468691", "0.119485 - 1.16", None]},
        geometry=[
            box(LON - 0.10, LAT - 0.1, LON - 0.02, LAT + 0.1),
            box(LON - 0.02, LAT - 0.1, LON + 0.00, LAT + 0.1),
            box(LON + 0.00, LAT - 0.1, LON + 0.02, LAT + 0.1),
        ],
        crs="EPSG:4326",
    )


def _write(tmp_path, driver="GeoJSON", crs="EPSG:4326"):
    d = tmp_path / ruido.DATASET
    d.mkdir(parents=True)
    if driver == "GeoJSON":
        _layer().to_crs(crs).to_file(d / "layer.json", driver="GeoJSON")
    else:
        _layer().to_crs(crs).to_file(d / "kernel_ruido.shp")
    return tmp_path


def _run(grid, raw_dir):
    out = finalize(ruido.TOPIC, ruido.compute(Context(grid=grid, raw_dir=raw_dir)))
    return out.merge(grid.assign(lon=grid.geometry.x)[["h3", "lon"]], on="h3")


def test_output_matches_contract(grid, tmp_path):
    out = _run(grid, _write(tmp_path))
    assert len(out) == len(grid) and out["h3"].is_unique
    schema = json.loads((CONTRACTS_DIR / "topic_output.schema.json").read_text())
    for row in out.drop(columns="lon").to_dict("records"):
        row["extra"] = json.loads(row["extra"])
        row["metric_raw"] = None if pd.isna(row["metric_raw"]) else float(row["metric_raw"])
        row["metric_label"] = None if pd.isna(row["metric_label"]) else row["metric_label"]
        row["score"] = None if pd.isna(row["score"]) else int(row["score"])
        validate(row, schema)
        assert "db_night" in row["extra"]


def test_lower_level_scores_better_and_uncovered_is_null(grid, tmp_path):
    out = _run(grid, _write(tmp_path))
    loud = out[out["lon"] < LON - 0.025]
    quiet = out[(out["lon"] > LON + 0.004) & (out["lon"] < LON + 0.015)]
    outside = out[out["lon"] > LON + 0.025]
    assert len(loud) and len(quiet) and len(outside)
    assert (loud["metric_raw"] == 2).all() and (quiet["metric_raw"] == 0).all()
    assert loud["score"].max() < quiet["score"].min()
    assert (loud["metric_label"] == ruido.LEVEL_LABELS[2]).all()
    assert outside["metric_raw"].isna().all() and outside["score"].isna().all() and outside["metric_label"].isna().all()
    border = out[(out["lon"] > LON - 0.019) & (out["lon"] < LON - 0.017)]
    assert border["metric_raw"].between(1, 2).all() and border["metric_raw"].mean() > 1.05


def test_reads_utm_shapefile(grid, tmp_path):
    a = _run(grid, _write(tmp_path / "a", "GeoJSON"))
    b = _run(grid, _write(tmp_path / "b", "ESRI Shapefile", crs="EPSG:32614"))
    pd.testing.assert_series_equal(a["metric_raw"], b["metric_raw"], atol=0.02)


def test_missing_data_gives_null_cells(grid, tmp_path):
    with pytest.warns(UserWarning):
        out = finalize(ruido.TOPIC, ruido.compute(Context(grid=grid, raw_dir=tmp_path)))
    assert len(out) == len(grid) and out["metric_raw"].isna().all() and out["score"].isna().all()
