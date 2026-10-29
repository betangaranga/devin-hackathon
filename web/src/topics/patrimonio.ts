import type { TopicMeta } from '../types'

const topic: TopicMeta = {
  "key": "patrimonio",
  "name": "Patrimonio",
  "short": "Patrimonio",
  "unit": "dentro o fuera de un área de conservación patrimonial",
  "scored": false,
  "color": "#9333ea",
  "order": 8,
  "why": "En zonas patrimoniales, cambios de fachada o ampliaciones requieren permisos de SEDUVI/INAH.",
  "ask": [
    "¿El inmueble está catalogado?",
    "¿Se pueden hacer remodelaciones?"
  ],
  "source": "SEDUVI · Áreas de conservación patrimonial, Inmuebles catalogados",
  "grain": "Polígono / punto"
}

export default topic
