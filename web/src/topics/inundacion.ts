import type { TopicMeta } from '../types'

const topic: TopicMeta = {
  "key": "inundacion",
  "name": "Lluvia intensa",
  "short": "Lluvia",
  "unit": "nivel del Atlas de Riesgo por precipitación (1–4)",
  "scored": true,
  "color": "#0ea5e9",
  "order": 1,
  "why": "Peligro por lluvia máxima del Atlas de Riesgo (periodo de retorno de 5 años). No mide encharcamientos: pregunta si la calle se inunda.",
  "ask": [
    "¿El departamento es planta baja o tiene sótano?",
    "¿Se ha metido el agua alguna vez?",
    "¿La calle se encharca en temporada de lluvias?"
  ],
  "source": "SGIRPC · Atlas de Riesgo (precipitación)",
  "grain": "Polígono de peligro"
}

export default topic
