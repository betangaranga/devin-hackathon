"""Merge topic outputs into per-cell JSON shards for the web app.

python -m pipeline.build            # from data/processed/*.parquet + base grid
python -m pipeline.build --fixtures # from fixtures/cells.json
"""
import argparse
import json
from collections import defaultdict
from datetime import date

import h3
import pandas as pd

from pipeline.common.context import load_grid
from pipeline.common.h3grid import SHARD_RES
from pipeline.common.paths import FIXTURES_DIR, PROCESSED_DIR, WEB_DATA_DIR
from pipeline.topics import discover


def cells_from_processed(use_fixture_grid: bool) -> list[dict]:
    grid = load_grid(use_fixture_grid)
    cells = {
        r.h3: {
            "h3": r.h3,
            "colonia": getattr(r, "colonia", None),
            "cp": getattr(r, "cp", None),
            "alcaldia": getattr(r, "alcaldia", None),
            "topics": {},
            "updated_at": date.today().isoformat(),
        }
        for r in grid.itertuples()
    }
    for key in sorted(discover()):
        path = PROCESSED_DIR / f"{key}.parquet"
        if not path.exists():
            continue
        for r in pd.read_parquet(path).itertuples():
            if r.h3 in cells:
                cells[r.h3]["topics"][key] = {
                    "score": None if pd.isna(r.score) else int(r.score),
                    "raw": None if pd.isna(r.metric_raw) else float(r.metric_raw),
                    "label": r.metric_label,
                    "extra": json.loads(r.extra),
                }
    return list(cells.values())


def write_shards(cells: list[dict]) -> int:
    shards = defaultdict(dict)
    for c in cells:
        shards[h3.cell_to_parent(c["h3"], SHARD_RES)][c["h3"]] = c
    out = WEB_DATA_DIR / "cells"
    out.mkdir(parents=True, exist_ok=True)
    for parent, content in shards.items():
        (out / f"{parent}.json").write_text(json.dumps(content, ensure_ascii=False))
    return len(shards)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixtures", action="store_true")
    args = ap.parse_args()
    cells = json.loads((FIXTURES_DIR / "cells.json").read_text()) if args.fixtures else cells_from_processed(False)
    n = write_shards(cells)
    print(f"{len(cells)} cells -> {n} shards in {WEB_DATA_DIR / 'cells'}")


if __name__ == "__main__":
    main()
