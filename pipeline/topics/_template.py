"""Copy to pipeline/topics/<key>.py. Files starting with '_' are not auto-discovered."""
import pandas as pd

from pipeline.common.context import Context
from pipeline.topics import TopicSpec

TOPIC = TopicSpec(
    key="template",
    label="Plantilla",
    unit="unidad",
    datasets=["id-ckan-del-dataset"],
    higher_is_better=False,
)


def compute(ctx: Context) -> pd.DataFrame:
    grid = ctx.grid
    raw = pd.Series(0.0, index=grid.index)
    return pd.DataFrame({
        "h3": grid["h3"],
        "metric_raw": raw,
        "metric_label": raw.map(lambda v: f"{v:.0f} unidad"),
        "extra": [{} for _ in range(len(grid))],
    })
