"""D3 tests (inundacion, granizo, calor) on a tiny synthetic sample: no network, no raw data."""
import json

import geopandas as gpd
import pandas as pd
import pytest
from jsonschema import validate
from shapely.geometry import box, mapping

from pipeline.common.context import Context
from pipeline.common.h3grid import cell_centroids, latlon_to_cell
from pipeline.common.paths import CONTRACTS_DIR
from pipeline.run import finalize
from pipeline.topics import calor, granizo, inundacion
from pipeline.topics._riesgo import LEVEL4, assign_polygons

SCHEMA = json.loads((CONTRACTS_DIR / "topic_output.schema.json").read_text())

# Four 0.01° strips around CDMX centre, west to east, plus one cell well outside all of them.
LAT = 19.40
STRIPS = [box(-99.20 + 0.01 * i, 19.38, -99.19 + 0.01 * i, 19.42) for i in range(4)]
CELLS = [latlon_to_cell(LAT, -99.195 + 0.01 * i) for i in range(4)]
FAR = latlon_to_cell(19.60, -98.70)
# Just east of the last strip: centroid outside every polygon but < 500 m away.
EDGE = latlon_to_cell(LAT, -99.1585)


@pytest.fixture
def grid():
    cells = CELLS + [EDGE, FAR]
    assert len(set(cells)) == len(cells)
    return cell_centroids(cells)


def _atlas_csv(path, intensidades, intens_num, encoding="utf-8"):
    rows = []
    for i, (geom, inten, num) in enumerate(zip(STRIPS, intensidades, intens_num)):
        row = {
            "id": float(i), "geo_point_2d": f"{LAT},{geom.centroid.x}", "geo_shape": json.dumps(mapping(geom)),
            "fenomeno": "Hidrometeorológicos", "taxonomia": "X", "r_p_v_e": "Peligro", "intensidad": inten,
            "cvegeo": f"09007000{i:05d}", "alcaldia": "Iztapalapa", "intens_num": num, "int2": None,
        }
        rows += [row, row]  # the real CSV lists each AGEB twice
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(path, index=False, encoding=encoding)


def _ctx(tmp_path, grid):
    return Context(grid=grid, raw_dir=tmp_path)


def _check_contract(spec, df, grid):
    out = finalize(spec, df)
    assert list(out["h3"]) == list(grid["h3"])
    for row in out.to_dict("records"):
        row["extra"] = json.loads(row["extra"])
        row["metric_raw"] = None if pd.isna(row["metric_raw"]) else float(row["metric_raw"])
        row["score"] = None if pd.isna(row["score"]) else int(row["score"])
        row["metric_label"] = None if pd.isna(row["metric_label"]) else row["metric_label"]
        validate(row, SCHEMA)
    return out


def test_level_mapping_collapses_top_classes():
    assert LEVEL4 == {1: 1, 2: 2, 3: 3, 4: 4, 5: 4}


def test_inundacion_levels_labels_and_scores(tmp_path, grid):
    _atlas_csv(tmp_path / "atlas-de-riesgo-precipitacion" / "p.csv",
               ["Muy Bajo", "Medio", "Alto", "Muy Alto"], ["41 a 54", "60 a 64", "64 a 70", "70 a 108"])
    df = inundacion.compute(_ctx(tmp_path, grid)).set_index("h3")
    assert df.loc[CELLS, "metric_raw"].tolist() == [1, 3, 4, 4]
    assert df.loc[CELLS[0], "metric_label"] == "Peligro muy bajo (1/4)"
    assert df.loc[CELLS[3], "metric_label"] == "Peligro muy alto (4/4)"
    assert df.loc[CELLS[3], "extra"] == {"level_label": "Peligro muy alto", "atlas_level": 5, "intensity": "70–108 mm"}
    s = df.loc[CELLS, "score"].tolist()
    assert s[0] > s[1] > s[2] > s[3]  # native class 5 still ranks below class 4
    assert df.loc[EDGE, "metric_raw"] == 4  # nearest-polygon fallback
    assert pd.isna(df.loc[FAR, "metric_raw"]) and df.loc[FAR, "extra"] == {} and pd.isna(df.loc[FAR, "score"])
    _check_contract(inundacion.TOPIC, df.reset_index(), grid)


def test_granizo_latin1_csv(tmp_path, grid):
    _atlas_csv(tmp_path / "atlas-de-riesgo-granizo" / "g.csv",
               ["Bajo", "Bajo", "Medio", "Muy Alto"], ["4", "4", "5", "Mayor a 6"], encoding="latin-1")
    df = granizo.compute(_ctx(tmp_path, grid)).set_index("h3")
    assert df.loc[CELLS, "metric_raw"].tolist() == [2, 2, 3, 4]
    assert df.loc[CELLS[3], "extra"]["intensity"] == "más de 6 días con granizo al año"
    _check_contract(granizo.TOPIC, df.reset_index(), grid)


def test_calor_from_geojson(tmp_path, grid):
    d = tmp_path / calor.TOPIC.datasets[0]
    d.mkdir()
    zones = gpd.GeoDataFrame({"OBJECTID": [1, 2, 3, 4], "RANGO": ["16-18", "14-16", "12-14", "8-10"]}, geometry=STRIPS, crs="EPSG:4326")
    zones.to_file(d / "zonas.json", driver="GeoJSON")
    df = calor.compute(_ctx(tmp_path, grid)).set_index("h3")
    assert df.loc[CELLS, "metric_raw"].tolist() == [17, 15, 13, 9]
    assert df.loc[CELLS[0], "metric_label"] == "17 °C media anual (zona 16–18 °C)"
    assert df.loc[CELLS[0], "extra"] == {"city_min": 9.0, "city_max": 17.0, "range": "16–18 °C"}
    out = _check_contract(calor.TOPIC, df.reset_index(), grid).set_index("h3")
    assert out.loc[CELLS[3], "score"] > out.loc[CELLS[0], "score"]  # cooler = better


def test_calor_from_zipped_shp(tmp_path, grid):
    import zipfile
    src = tmp_path / "shp"
    src.mkdir()
    gpd.GeoDataFrame({"RANGO": ["10-12"]}, geometry=[box(-99.3, 19.3, -99.1, 19.5)], crs="EPSG:4326").to_file(src / "t.shp")
    d = tmp_path / calor.TOPIC.datasets[0]
    d.mkdir()
    with zipfile.ZipFile(d / "t.zip", "w") as z:
        for f in src.iterdir():
            z.write(f, f"sub/{f.name}")
    df = calor.compute(_ctx(tmp_path, grid)).set_index("h3")
    assert df.loc[CELLS, "metric_raw"].tolist() == [11, 11, 11, 11]


@pytest.mark.parametrize("mod", [inundacion, granizo, calor])
def test_missing_raw_data_gives_nulls(tmp_path, grid, mod):
    df = mod.compute(_ctx(tmp_path, grid))
    assert df["metric_raw"].isna().all() and len(df) == len(grid)
    _check_contract(mod.TOPIC, df, grid)


def test_assign_polygons_keeps_grid_order(grid):
    polys = gpd.GeoDataFrame({"v": [1.0, 2.0]}, geometry=STRIPS[:2], crs="EPSG:4326")
    out = assign_polygons(polys, grid.iloc[::-1].reset_index(drop=True), ["v"])
    assert out["h3"].tolist() == list(reversed(grid["h3"].tolist()))
