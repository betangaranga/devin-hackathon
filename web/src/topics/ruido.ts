import type { TopicMeta } from '../types'

const topic: TopicMeta = {
  "key": "ruido",
  "name": "Ruido",
  "short": "Ruido",
  "unit": "dB estimados (día / noche)",
  "scored": true,
  "color": "#7c3aed",
  "order": 4,
  "why": "Avenidas, bares y obras cambian mucho la calidad de sueño y el trabajo desde casa.",
  "ask": [
    "¿Las recámaras dan a la calle o al interior?",
    "¿Ventanas con doble vidrio?"
  ],
  "source": "SEDEMA · Contaminación acústica",
  "grain": "Polígono / corredor"
}

export default topic
