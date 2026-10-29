import type { TopicMeta } from '../types'

const topic: TopicMeta = {
  "key": "granizo",
  "name": "Granizo",
  "short": "Granizo",
  "unit": "nivel del Atlas de Riesgo por granizo (1–4)",
  "scored": true,
  "color": "#64748b",
  "order": 6,
  "why": "Las granizadas fuertes tapan coladeras, dañan autos y domos.",
  "ask": [
    "¿Hay techado para el auto?",
    "¿Las coladeras de la calle se tapan?"
  ],
  "source": "SGIRPC · Atlas de Riesgo (granizo)",
  "grain": "Polígono de peligro"
}

export default topic
