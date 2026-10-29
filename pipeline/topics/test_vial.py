import json

import pandas as pd
import pytest
from jsonschema import validate

from pipeline.common.context import Context, load_grid
from pipeline.common.paths import CONTRACTS_DIR
from pipeline.run import finalize
from pipeline.topics import vial

COLS = ["folio", "fecha_creacion", "hora_creacion", "dia_semana", "fecha_cierre", "hora_cierre", "tipo_incidente_c4",
        "incidente_c4", "alcaldia_inicio", "codigo_cierre", "clas_con_f_alarma", "tipo_entrada", "alcaldia_cierre",
        "alcaldia_catalogo", "colonia_catalogo", "longitud", "latitud"]


def _row(i, date, lat, lon, code="A", tipo="Accidente", inc="Choque sin lesionados"):
    return dict(zip(COLS, [f"X/{i}", date, "10:00:00", "Lunes", date, "11:00:00", tipo, inc, "NA", code,
                           "EMERGENCIA", "LLAMADA DEL 911", "NA", "Cuauhtémoc", "Roma Norte", lon, lat]))


@pytest.fixture(scope="module")
def ctx(tmp_path_factory):
    raw = tmp_path_factory.mktemp("raw")
    grid = load_grid(use_fixtures=True)
    hot = grid.iloc[0].geometry
    rows, i = [], 0
    for y in (2020, 2021, 2022, 2023):
        for m in range(1, 13):
            for _ in range(2):
                rows.append(_row(i, f"{y}-{m:02d}-15", hot.y + 0.0001, hot.x)); i += 1
    rows.append(_row(i, "2023-05-01", hot.y, hot.x, tipo="Cadáver", inc="Atropellado")); i += 1
    rows.append(_row(i, "2023-05-01", hot.y, hot.x, code="F")); i += 1      # false, ignored
    rows.append(_row(i, "2023-05-01", 25.0, -99.1)); i += 1                 # outside CDMX, ignored
    rows.append(_row(i, "2024-01-10", hot.y, hot.x)); i += 1                # partial year, ignored
    d = raw / vial.C5
    d.mkdir()
    half = len(rows) // 2
    pd.DataFrame(rows[:half]).to_csv(d / "inViales_a.csv", index=False)
    pd.DataFrame(rows[half:]).to_csv(d / "inViales_b.csv", index=False)
    s = raw / vial.SAFE
    s.mkdir()
    pd.DataFrame({"id": [0], "interseccion": ["Cruce Seguro"], "latitud": [hot.y], "longitud": [hot.x]}).to_csv(s / "x.csv", index=False)
    return Context(grid=grid, raw_dir=raw)


def test_full_years(ctx):
    df = vial.load_c5(ctx)
    assert set(df.year) == {2020, 2021, 2022, 2023, 2024}
    assert vial.full_years(df) == [2021, 2022, 2023]


def test_compute_contract(ctx):
    out = finalize(vial.TOPIC, vial.compute(ctx))
    assert len(out) == len(ctx.grid) and out.h3.is_unique
    hot = out.iloc[0]
    assert hot.metric_raw == pytest.approx((72 + 1) / 3, abs=0.1)
    far = out[out.metric_raw == 0]
    assert len(far) and (far.score > hot.score).all()
    e = json.loads(hot.extra)
    assert len(e["monthly"]) == 12 and e["monthly"][4] == 3 and sum(e["monthly"]) == 25
    assert e["weighted"] == pytest.approx((72 + 5) / 3, abs=0.1)
    assert e["hotspots"][0]["name"] == "Cruce Seguro" and len(e["hotspots"]) <= 3
    assert e["period"] == "2021–2023"
    schema = json.loads((CONTRACTS_DIR / "topic_output.schema.json").read_text())
    for _, r in out.iterrows():
        row = r.to_dict()
        row["extra"] = json.loads(row["extra"])
        row["score"] = None if pd.isna(row["score"]) else int(row["score"])
        row["metric_raw"] = float(row["metric_raw"])
        validate(row, schema)
