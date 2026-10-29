"""Granizo: peligro por granizo del Atlas de Riesgo CDMX (SPCGIR 2019), por AGEB.

Nivel 1-4 = clase del Atlas (Muy bajo=1, Bajo=2, Medio=3, Alto y Muy alto=4). La clase sale
de los días con granizo al año para un periodo de retorno de 5 años.
"""
import pandas as pd

from pipeline.common.context import Context
from pipeline.topics import TopicSpec
from pipeline.topics._riesgo import hazard_topic

TOPIC = TopicSpec(
    key="granizo",
    label="Granizo",
    unit="nivel de peligro 1–4 (Atlas de Riesgo, granizo)",
    datasets=["atlas-de-riesgo-granizo"],
    higher_is_better=False,
)


def _intensity(v) -> str | None:
    if pd.isna(v):
        return None
    s = str(v).replace("Mayor a ", "más de ").replace(" a ", "–")
    return f"{s} días con granizo al año"


def compute(ctx: Context) -> pd.DataFrame:
    return hazard_topic(ctx, TOPIC.datasets[0], _intensity)
