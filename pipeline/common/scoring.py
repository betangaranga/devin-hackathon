import numpy as np
import pandas as pd


def percentile_score(values: pd.Series, higher_is_better: bool, reference: pd.Series | None = None) -> pd.Series:
    """0-100 score: share of reference cells (default: all) this cell beats. NaN stays NaN.

    `reference` is a boolean mask (e.g. inhabited cells); every cell is ranked against that distribution.
    """
    values = pd.to_numeric(values, errors="coerce").astype(float)
    ref = values[reference.fillna(False).astype(bool)] if reference is not None else values
    ref = np.sort(ref.dropna().to_numpy())
    if len(ref) == 0:
        return pd.Series(pd.NA, index=values.index, dtype="Int64")
    below = np.searchsorted(ref, values.to_numpy(), side="left")
    above = len(ref) - np.searchsorted(ref, values.to_numpy(), side="right")
    ties = len(ref) - below - above
    if higher_is_better:
        frac = (below + ties / 2 + 0.5) / len(ref)
    else:
        frac = (above + ties / 2 + 0.5) / len(ref)
    score = pd.Series(np.round(np.clip(frac, 0, 1) * 100), index=values.index)
    return score.where(values.notna()).astype("Int64")


def status(score: int | None) -> str | None:
    if score is None or pd.isna(score):
        return None
    if score >= 67:
        return "bien"
    if score >= 34:
        return "regular"
    return "atencion"
