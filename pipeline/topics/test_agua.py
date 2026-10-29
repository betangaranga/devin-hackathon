import json

import geopandas as gpd
import pandas as pd
import pytest
from jsonschema import validate
from shapely.geometry import box

from pipeline.common.context import Context, load_grid
from pipeline.common.paths import CONTRACTS_DIR
from pipeline.run import finalize
from pipeline.topics import agua

HIGH = ("Las Arboledas (ejemplo)", "Alcaldía Norte (ejemplo)")
LOW = ("Valle Verde (ejemplo)", "Alcaldía Oriente (ejemplo)")
REPORT_COLS = ["folio_incidente", "fecha_registro_incidente", "id_reporte", "fecha_reporte", "hora_reporte",
               "clasificacion", "reporte", "medio_recepcion", "alcaldia_catalogo", "colonia_catalogo",
               "longitud", "latitud"]


@pytest.fixture(scope="module")
def grid():
    return load_grid(use_fixtures=True)


def _cells(grid, key):
    return grid[(grid["colonia"] == key[0]) & (grid["alcaldia"] == key[1])]


def _report(i, cell, date, kind="Falta de agua"):
    return {"folio_incidente": f"I-{i}", "fecha_registro_incidente": date, "id_reporte": f"R-{i}",
            "fecha_reporte": date, "hora_reporte": "10:00:00", "clasificacion": "Agua Potable", "reporte": kind,
            "medio_recepcion": "Ciudadano (Call Center)", "alcaldia_catalogo": "x", "colonia_catalogo": "x",
            "longitud": cell.geometry.x, "latitud": cell.geometry.y}


@pytest.fixture(scope="module")
def raw_dir(grid, tmp_path_factory):
    root = tmp_path_factory.mktemp("raw")
    months = pd.period_range("2022-02", "2024-01", freq="M")
    high, low = _cells(grid, HIGH), _cells(grid, LOW)
    rows, i = [], 0
    for m in months:
        for k in range(30):
            rows.append(_report(i, high.iloc[k % len(high)], f"{m}-05")); i += 1
        for k in range(3):
            rows.append(_report(i, low.iloc[k], f"{m}-10")); i += 1
        rows.append(_report(i, low.iloc[0], f"{m}-11", kind="Fuga")); i += 1
    rows.append(rows[0])  # duplicated id_reporte
    rows.append(_report(i, high.iloc[0], "2024-02-01"))  # sparse trailing month, dropped from the window
    rows.append({**_report(i + 1, high.iloc[0], "2023-05-01"), "latitud": 37.7, "longitud": -122.4})
    d = root / agua.REPORTES
    d.mkdir()
    pd.DataFrame(rows, columns=REPORT_COLS).to_csv(d / "reportes.csv", index=False)
    pd.DataFrame({"folio": ["1"], "tipo_de_falla": ["Falta de agua"], "latitud": [19.4], "longitud": [-99.1],
                  "fecha": ["2019-01-01"]}).to_csv(d / "historico.csv", index=False)

    d = root / agua.CONSUMO
    d.mkdir()
    pts = high.iloc[:2]
    pd.DataFrame({"fecha_referencia": "2019-02-28", "anio": 2019, "bimestre": 1, "consumo_total_dom": [100.0, 300.0],
                  "consumo_prom_dom": [20.0, 30.0], "indice_des": "BAJO", "colonia": "X", "alcaldia": "Y",
                  "latitud": pts.geometry.y.to_numpy(), "longitud": pts.geometry.x.to_numpy()}
                 ).to_csv(d / "consumo.csv", index=False, encoding="latin-1")

    d = root / agua.COBERTURA
    d.mkdir()
    b = grid.total_bounds
    gpd.GeoDataFrame({"cve_col": ["01-001"], "colonia": ["X"], "pob_2010": [1000.0], "LongInf_m": [1500.0],
                      "m_x_hab": [1.5]}, geometry=[box(*b)], crs="EPSG:4326").to_file(d / "cobertura.json", driver="GeoJSON")
    return root


@pytest.fixture(scope="module")
def out(grid, raw_dir):
    return finalize(agua.TOPIC, agua.compute(Context(grid=grid, raw_dir=raw_dir)))


def test_output_matches_contract(out, grid):
    schema = json.loads((CONTRACTS_DIR / "topic_output.schema.json").read_text())
    assert len(out) == len(grid) and out["h3"].is_unique
    for row in out.to_dict("records"):
        row["extra"] = json.loads(row["extra"])
        row["score"] = None if pd.isna(row["score"]) else int(row["score"])
        row["metric_raw"] = None if pd.isna(row["metric_raw"]) else float(row["metric_raw"])
        validate(row, schema)


def test_rates_and_direction(out, grid):
    df = out.merge(grid[["h3", "colonia", "alcaldia"]], on="h3")
    by = df.groupby(["colonia", "alcaldia"]).agg(raw=("metric_raw", "first"), score=("score", "first"))
    assert by.loc[HIGH, "raw"] > by.loc[LOW, "raw"]
    assert by.loc[HIGH, "score"] < by.loc[LOW, "score"]
    # 30 reports/month over 113,730 hab. ≈ 3.2 per 1,000 hab./año, slightly pulled toward the city rate.
    assert 2.5 < by.loc[HIGH, "raw"] < 3.3
    assert df.groupby(["colonia", "alcaldia"])["metric_raw"].nunique().max() == 1


def test_extra_fields(out, grid):
    high = set(_cells(grid, HIGH)["h3"])
    e = json.loads(out[out["h3"].isin(high)]["extra"].iloc[0])
    assert len(e["monthly"]) == 12 and len(e["city_monthly"]) == 12
    assert e["months"][0] == "2023-02" and e["months"][-1] == "2024-01"
    assert e["period"] == "2022-02/2024-01"
    assert e["reports"] == 24 * 30
    assert sum(e["monthly"]) > sum(e["city_monthly"])
    assert e["consumo_dom_m3_bim"] == pytest.approx(400 / (100 / 20 + 300 / 30), abs=0.1)
    assert e["red_m_hab"] == 1.5 and e["city_red_m_hab"] == 1.5


def test_no_raw_data(grid, tmp_path):
    out = finalize(agua.TOPIC, agua.compute(Context(grid=grid, raw_dir=tmp_path)))
    assert len(out) == len(grid) and out["metric_raw"].isna().all() and out["score"].isna().all()
