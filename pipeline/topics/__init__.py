"""Topic registry. Each module in this package (not starting with '_' or 'test_') defines:

    TOPIC = TopicSpec(...)
    def compute(ctx: Context) -> pd.DataFrame  # columns: h3, metric_raw, metric_label, extra (dict)

`score` is added by the runner from metric_raw unless compute() returns it.
"""
import importlib
import pkgutil
from dataclasses import dataclass, field


@dataclass(frozen=True)
class TopicSpec:
    key: str
    label: str
    unit: str
    datasets: list[str] = field(default_factory=list)
    higher_is_better: bool = False
    scored: bool = True


def discover() -> dict:
    mods = {}
    for info in pkgutil.iter_modules(__path__):
        if info.name.startswith(("_", "test_")):
            continue
        mod = importlib.import_module(f"{__name__}.{info.name}")
        if hasattr(mod, "TOPIC") and hasattr(mod, "compute"):
            mods[mod.TOPIC.key] = mod
    return mods
