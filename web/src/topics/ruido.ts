import type { TopicMeta } from '../types'

const topic: TopicMeta = {
  "key": "ruido",
  "name": "Ruido",
  "short": "Ruido",
  "unit": "nivel de denuncias de ruido (0–2)",
  "scored": true,
  "color": "#7c3aed",
  "order": 4,
  "why": "Densidad de denuncias de ruido ante la PAOT (2020). No es ruido medido en dB: zonas que denuncian menos pueden salir mejor.",
  "ask": [
    "¿Las recámaras dan a la calle o al interior?",
    "¿Ventanas con doble vidrio?"
  ],
  "source": "PAOT / CentroGeo · Denuncias por contaminación acústica (2020)",
  "grain": "Superficie de densidad (kernel)"
}

export default topic
