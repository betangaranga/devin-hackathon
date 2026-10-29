import type { TopicMeta } from '../types'

const topic: TopicMeta = {
  "key": "vial",
  "name": "Seguridad vial",
  "short": "Vial",
  "unit": "incidentes viales a < 500 m (12 meses)",
  "scored": true,
  "color": "#ef4444",
  "order": 3,
  "why": "Importa si caminas con niños, usas bici o cruzas avenidas a diario.",
  "ask": [
    "¿Hay cruces seguros cerca de la escuela o el transporte?"
  ],
  "source": "C5 · Incidentes viales; SSC · Hechos de tránsito",
  "grain": "Punto · fecha y hora"
}

export default topic
