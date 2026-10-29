import pandas as pd


def percentile_score(values: pd.Series, higher_is_better: bool) -> pd.Series:
    """0-100 score: share of CDMX cells this cell beats. NaN stays NaN."""
    ranks = values.rank(pct=True, method="average")
    score = ranks if higher_is_better else 1 - ranks + (1 / values.notna().sum())
    return (score.clip(0, 1) * 100).round().astype("Int64")


def status(score: int | None) -> str | None:
    if score is None or pd.isna(score):
        return None
    if score >= 67:
        return "bien"
    if score >= 34:
        return "regular"
    return "atencion"
