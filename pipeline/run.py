"""Run topics: python -m pipeline.run [topic ...] [--fixtures]"""
import argparse
import json

import pandas as pd

from pipeline.common.context import Context, load_grid
from pipeline.common.paths import CONTRACTS_DIR, PROCESSED_DIR
from pipeline.common.scoring import percentile_score
from pipeline.topics import discover

REQUIRED = ["h3", "metric_raw", "metric_label", "score", "extra"]


def inhabited_mask(df: pd.DataFrame, grid: pd.DataFrame | None) -> pd.Series | None:
    if grid is None or "pop" not in grid:
        return None
    pop = df["h3"].map(grid.set_index("h3")["pop"])
    return pop > 0 if (pop > 0).any() else None


def finalize(spec, df: pd.DataFrame, grid: pd.DataFrame | None = None) -> pd.DataFrame:
    df = df.copy()
    if "score" not in df:
        ref = inhabited_mask(df, grid)
        df["score"] = percentile_score(df["metric_raw"], spec.higher_is_better, ref) if spec.scored else pd.NA
    missing = [c for c in REQUIRED if c not in df]
    if missing:
        raise ValueError(f"{spec.key}: missing columns {missing}")
    if df["h3"].duplicated().any():
        raise ValueError(f"{spec.key}: duplicated h3 cells")
    df["extra"] = df["extra"].map(lambda e: json.dumps(e or {}, ensure_ascii=False, default=str))
    return df[REQUIRED]


def run_topic(mod, ctx: Context) -> pd.DataFrame:
    out = finalize(mod.TOPIC, mod.compute(ctx), ctx.grid)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out.to_parquet(PROCESSED_DIR / f"{mod.TOPIC.key}.parquet", index=False)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("topics", nargs="*")
    ap.add_argument("--fixtures", action="store_true", help="use fixtures/grid.csv as the base grid")
    args = ap.parse_args()
    mods = discover()
    ctx = Context(grid=load_grid(args.fixtures))
    for key in args.topics or sorted(mods):
        out = run_topic(mods[key], ctx)
        print(f"{key}: {len(out)} cells, {out['metric_raw'].notna().sum()} with data")
    assert (CONTRACTS_DIR / "topic_output.schema.json").exists()


if __name__ == "__main__":
    main()
