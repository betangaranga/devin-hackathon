import type { TopicMeta } from "@/lib/topics";

const topic: TopicMeta = {
  key: "inundacion",
  name: "Inundación",
  short: "Inundación",
  unit: "nivel del Atlas de Riesgo por precipitación",
  why: "Afecta sobre todo plantas bajas, estacionamientos y la movilidad en lluvias (jun–sep).",
  ask: [
    "¿El departamento es planta baja o tiene sótano?",
    "¿Se ha metido el agua alguna vez?",
    "¿La calle se encharca en temporada de lluvias?",
  ],
  source: "SGIRPC · Atlas de Riesgo (precipitación)",
  grain: "Polígono de peligro",
  mapColor: "blue",
  scored: true,
};

export default topic;
