"""Inundación: peligro por precipitación del Atlas de Riesgo CDMX (SPCGIR 2019), por AGEB.

Nivel 1-4 = clase del Atlas (Muy bajo=1, Bajo=2, Medio=3, Alto y Muy alto=4). El Atlas mide
precipitación máxima (mm, periodo de retorno 5 años), no encharcamientos observados.
"""
import pandas as pd

from pipeline.common.context import Context
from pipeline.topics import TopicSpec
from pipeline.topics._riesgo import hazard_topic

TOPIC = TopicSpec(
    key="inundacion",
    label="Inundación",
    unit="nivel de peligro 1–4 (Atlas de Riesgo, precipitación)",
    datasets=["atlas-de-riesgo-precipitacion"],
    higher_is_better=False,
)


def _intensity(v) -> str | None:
    return None if pd.isna(v) else f"{str(v).replace(' a ', '–')} mm"


def compute(ctx: Context) -> pd.DataFrame:
    return hazard_topic(ctx, TOPIC.datasets[0], _intensity)
