import json
import shutil

import geopandas as gpd
import h3
import pytest
from jsonschema import validate
from shapely.geometry import LineString, Point

from pipeline.common.context import Context
from pipeline.common.h3grid import cell_centroids
from pipeline.common.paths import CONTRACTS_DIR
from pipeline.run import finalize
from pipeline.topics import discover, servicios

CENTER = (19.4194, -99.1556)  # lat, lon (Roma Norte)


def _write_zip_shp(tmp_path, dataset, layers):
    """Write {filename: gdf} as shapefiles zipped into raw/<dataset>/<dataset>.zip."""
    work = tmp_path / "work" / dataset
    work.mkdir(parents=True)
    for name, gdf in layers.items():
        gdf.to_file(work / f"{name}.shp")
    out = tmp_path / "raw" / dataset
    out.mkdir(parents=True)
    shutil.make_archive(str(out / dataset), "zip", work)


def _geojson(tmp_path, dataset, gdf):
    out = tmp_path / "raw" / dataset
    out.mkdir(parents=True)
    gdf.to_file(out / f"{dataset}.json", driver="GeoJSON")


def _pt(dlat=0.0, dlon=0.0):
    return Point(CENTER[1] + dlon, CENTER[0] + dlat)


@pytest.fixture
def raw(tmp_path):
    crs = "EPSG:4326"
    _write_zip_shp(tmp_path, "centros-de-salud", {"Centros_de_salud": gpd.GeoDataFrame(
        {"NOM_UNIDAD": ["C.S. CERCA", "C.S. CERRADO"], "ESTATU_OPE": ["EN OPERACIÓN", "FUERA DE OPERACIÓN (TOTAL O PARCIAL)"]},
        geometry=[_pt(0.005), _pt()], crs=crs)})
    _write_zip_shp(tmp_path, "escuelas-publicas", {"escuelas": gpd.GeoDataFrame(
        {"nombre": ["PRIMARIA X"]}, geometry=[_pt(0, 0.002)], crs=crs)})
    _geojson(tmp_path, "mercados-publicos", gpd.GeoDataFrame({"MERCADO": ["MEDELLIN"]}, geometry=[_pt(-0.004)], crs=crs))
    _geojson(tmp_path, "mercados-sobre-ruedas", gpd.GeoDataFrame(
        {"Ruta": ["RUTA 1"], "Día_Oper": ["Lunes"]}, geometry=[_pt(0.2, 0.2)], crs=crs))
    _write_zip_shp(tmp_path, "lineas-y-estaciones-del-metro", {
        "STC_Metro_lineas_utm14n": gpd.GeoDataFrame({"LINEA": ["03"]}, geometry=[LineString([_pt(-0.01), _pt(0.01)])], crs=crs),
        "STC_Metro_estaciones_utm14n": gpd.GeoDataFrame(
            {"NOMBRE": ["Insurgentes"], "LINEA": ["01"]}, geometry=[_pt(0, -0.01)], crs=crs).to_crs("EPSG:32614"),
    })
    return tmp_path / "raw"


@pytest.fixture
def grid():
    center = h3.latlng_to_cell(*CENTER, 9)
    far = h3.latlng_to_cell(19.20, -99.05, 9)  # ~30 km away
    return cell_centroids([center, *sorted(h3.grid_ring(center, 1)), far])


def test_discovered():
    assert discover()["servicios"] is servicios


def test_load_points(raw, grid):
    pts = servicios.load_points(Context(grid=grid, raw_dir=raw))
    assert pts.crs.to_string() == "EPSG:4326"
    assert sorted(pts["kind"].value_counts().items()) == [("escuela", 1), ("mercado", 2), ("salud", 1), ("transporte", 1)]
    assert "C.S. CERRADO" not in set(pts["name"])
    metro = pts[pts["kind"] == "transporte"].iloc[0]
    assert metro["name"] == "Metro Insurgentes (L1)"
    assert metro.geometry.x == pytest.approx(CENTER[1] - 0.01, abs=1e-6)  # reprojected from UTM


def test_compute_contract(raw, grid):
    ctx = Context(grid=grid, raw_dir=raw)
    out = finalize(servicios.TOPIC, servicios.compute(ctx))
    assert len(out) == len(grid) and out["h3"].is_unique
    schema = json.loads((CONTRACTS_DIR / "topic_output.schema.json").read_text())
    for row in out.to_dict("records"):
        row["extra"] = json.loads(row["extra"])
        row["score"] = int(row["score"])
        row["metric_raw"] = float(row["metric_raw"])
        validate(row, schema)
        kinds = [n["kind"] for n in row["extra"]["nearest"]]
        assert kinds == ["salud", "escuela", "mercado", "transporte"]
        for n in row["extra"]["nearest"]:
            assert set(n) == {"kind", "name", "minutes", "lat", "lon"} and n["minutes"] >= 0

    center, far = out.iloc[0], out.iloc[-1]
    near = {n["kind"]: n for n in json.loads(center["extra"])["nearest"]}
    assert near["mercado"]["name"] == "Mercado Medellin"
    # 0.005° lat ≈ 553 m → 553 * 1.3 / 80 ≈ 9 min
    assert 8 <= near["salud"]["minutes"] <= 10
    assert center["metric_raw"] < 15 and far["metric_raw"] == servicios.CAP_MINUTES
    assert center["score"] > far["score"]
    assert json.loads(far["extra"])["nearest"][0]["minutes"] > servicios.CAP_MINUTES  # uncapped in extra


def test_missing_datasets_are_skipped(tmp_path, grid):
    out = servicios.compute(Context(grid=grid, raw_dir=tmp_path))
    assert out["metric_raw"].isna().all()
    assert all(e == {"nearest": []} for e in out["extra"])
