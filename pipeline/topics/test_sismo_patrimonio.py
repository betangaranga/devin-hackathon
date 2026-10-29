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
from pipeline.topics import patrimonio, sismo

SCHEMA = json.loads((CONTRACTS_DIR / "topic_output.schema.json").read_text())
CENTER = h3.cell_to_latlng(h3.latlng_to_cell(19.4190, -99.1640, 9))  # Roma Norte, at the cell centroid
FAR = (19.3000, -99.0000)


def _grid():
    origin = h3.latlng_to_cell(*CENTER, 9)
    cells = sorted(h3.grid_disk(origin, 2)) + [h3.latlng_to_cell(*FAR, 9)]
    return cell_centroids(cells), origin


def _write(path, rows, encoding="utf-8"):
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(path, index=False, encoding=encoding)


@pytest.fixture
def raw(tmp_path):
    lat, lon = CENTER
    _write(tmp_path / sismo.ATENCION / "a.csv", [
        {"tipo_apoyo": "RECONSTRUCCION", "estatus": "EN OBRA", "calle": "DURANGO", "numero_exterior": "10", "colonia": "ROMA NORTE",
         "latitud": lat + 0.001, "longitud": lon},
        # decimal point lost in the source: must be repaired, not dropped
        {"tipo_apoyo": "REHABILITACION", "estatus": "CONCLUIDA", "calle": "COLIMA", "numero_exterior": "", "colonia": "ROMA NORTE",
         "latitud": int(round((lat - 0.001) * 1e6)), "longitud": int(round(lon * 1e8))},
    ])
    _write(tmp_path / sismo.MULTI / "m.csv", [
        # same building as the first Plan Integral record (~5 m away): deduplicated
        {"calle": "DURANGO", "num_exterior": "10.0", "colonia": "ROMA NORTE", "estatus_general": "EN PROCESO DE OBRA",
         "latitud": lat + 0.00104, "longitud": lon + 0.00002},
        {"calle": "TONALA", "num_exterior": "5.0", "colonia": "ROMA NORTE", "estatus_general": None, "latitud": None, "longitud": None},
    ])
    _write(tmp_path / sismo.UNI / "u.csv", [
        {"calle_inmueble": "ORIZABA", "exterior_inmueble": "S/D", "colonia_inmueble": "ROMA NORTE", "estatus_obra": "EN REVISIÓN",
         "latitud": lat, "longitud": lon + 0.002},
        {"calle_inmueble": "LEJOS", "exterior_inmueble": "1", "colonia_inmueble": "OTRA", "estatus_obra": "RECONSTRUCCIÓN",
         "latitud": lat + 0.02, "longitud": lon},
    ], encoding="latin-1")
    zone = box(lon - 0.003, lat - 0.003, lon + 0.003, lat + 0.003)
    gpd.GeoDataFrame({"nombre": ["Condesa-Roma"]}, geometry=[zone], crs="EPSG:4326").to_file(
        (tmp_path / patrimonio.ZONES).mkdir() or tmp_path / patrimonio.ZONES / "z.json", driver="GeoJSON")
    (tmp_path / patrimonio.ZONES / "package.json").write_text("{}")
    _write(tmp_path / patrimonio.CATALOG / "c.csv", [
        {"SP_NOMBRE": "ACP, INBA", "X": lon, "Y": lat + 0.0005},
        {"SP_NOMBRE": "SEDUVI", "X": lon + 0.0025, "Y": lat},  # ~260 m east
        {"SP_NOMBRE": "ACP", "X": lon, "Y": lat},  # just inside the area, not catalogued
        {"SP_NOMBRE": "ACP, CC", "X": lon, "Y": lat},  # neighbour of a catalogued building
    ])
    return tmp_path


def _validate(spec, df):
    out = finalize(spec, df)
    for row in out.to_dict("records"):
        row["extra"] = json.loads(row["extra"])
        row["score"] = None if pd.isna(row["score"]) else int(row["score"])
        row["metric_raw"] = None if pd.isna(row["metric_raw"]) else float(row["metric_raw"])
        validate(row, SCHEMA)
    return out


def test_fix_coord():
    s = sismo.fix_coord(pd.Series(["-9910252997", "-99.1", "19366108", "abc", "-120.5"]), -99.4, -98.9)
    assert s.iloc[0] == pytest.approx(-99.10252997) and s.iloc[1] == -99.1
    assert pd.isna(s.iloc[3]) and pd.isna(s.iloc[4])
    assert sismo.fix_coord(pd.Series(["19366108"]), 19.0, 19.65).iloc[0] == pytest.approx(19.366108)


def test_sismo(raw):
    grid, origin = _grid()
    ctx = Context(grid=grid, raw_dir=raw)
    pts = sismo.load_buildings(ctx)
    assert len(pts) == 4  # 2 atención + 0 multi (dup + no coords) + 2 uni
    df = sismo.compute(ctx)
    out = _validate(sismo.TOPIC, df)
    row = df.set_index("h3").loc[origin]
    assert row.metric_raw == 3 and row.metric_label == "3 inmuebles"
    nearby = row.extra["nearby"]
    assert [n["name"] for n in nearby][0] == "Durango 10, Roma Norte"
    assert nearby[0]["status"] == "Reconstrucción en obra"
    assert {n["status"] for n in nearby} == {"Reconstrucción en obra", "Rehabilitación concluida", "En revisión"}
    assert any(n["name"] == "Orizaba, Roma Norte" for n in nearby)
    far = out.set_index("h3").loc[h3.latlng_to_cell(*FAR, 9)]
    assert json.loads(far.extra) == {"nearby": []} and far.score > out.set_index("h3").loc[origin].score


def test_sismo_nearby_capped(raw):
    lat, lon = CENTER
    _write(raw / sismo.UNI / "u.csv", [
        {"calle_inmueble": f"CALLE {i}", "exterior_inmueble": i, "colonia_inmueble": "X", "estatus_obra": "", "latitud": lat + i * 1e-4, "longitud": lon}
        for i in range(15)
    ])
    grid, origin = _grid()
    df = sismo.compute(Context(grid=grid, raw_dir=raw)).set_index("h3")
    nearby = df.loc[origin, "extra"]["nearby"]
    assert len(nearby) == sismo.MAX_NEARBY and nearby[0]["status"] == "Dañado en 2017"


def test_patrimonio(raw):
    grid, origin = _grid()
    df = patrimonio.compute(Context(grid=grid, raw_dir=raw))
    out = _validate(patrimonio.TOPIC, df)
    assert out["score"].isna().all()
    row = df.set_index("h3").loc[origin]
    assert row.metric_raw == 1 and row.metric_label == "Dentro de: Condesa-Roma"
    assert row.extra == {"in_zone": True, "zone_name": "Condesa-Roma", "catalogados_300m": 2, "catalogados_200m": 1}
    far = df.set_index("h3").loc[h3.latlng_to_cell(*FAR, 9)]
    assert far.metric_raw == 0 and far.extra["zone_name"] is None and far.extra["catalogados_300m"] == 0


def test_missing_raw_data(tmp_path):
    grid, _ = _grid()
    for mod in (sismo, patrimonio):
        out = _validate(mod.TOPIC, mod.compute(Context(grid=grid, raw_dir=tmp_path)))
        assert out["metric_raw"].isna().all()
