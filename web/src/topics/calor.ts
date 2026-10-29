import type { TopicMeta } from '../types'

const topic: TopicMeta = {
  "key": "calor",
  "name": "Calor",
  "short": "Calor",
  "unit": "temperatura media anual de la zona (°C)",
  "scored": true,
  "color": "#f97316",
  "order": 5,
  "why": "Zonas más calientes y con poco arbolado elevan la temperatura interior en primavera.",
  "ask": [
    "¿Último piso o con azotea expuesta?",
    "¿Tiene ventilación cruzada?"
  ],
  "source": "SEDEMA · Zonas de temperatura media anual",
  "grain": "Polígono"
}

export default topic
