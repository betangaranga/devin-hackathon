import type { TopicMeta } from '../types'

const topic: TopicMeta = {
  "key": "inundacion",
  "name": "Inundación",
  "short": "Inundación",
  "unit": "nivel del Atlas de Riesgo por precipitación (1–4)",
  "scored": true,
  "color": "#0ea5e9",
  "order": 1,
  "why": "Afecta sobre todo plantas bajas, estacionamientos y la movilidad en lluvias (jun–sep).",
  "ask": [
    "¿El departamento es planta baja o tiene sótano?",
    "¿Se ha metido el agua alguna vez?",
    "¿La calle se encharca en temporada de lluvias?"
  ],
  "source": "SGIRPC · Atlas de Riesgo (precipitación)",
  "grain": "Polígono de peligro"
}

export default topic
