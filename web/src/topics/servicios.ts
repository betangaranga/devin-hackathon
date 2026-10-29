import type { TopicMeta } from '../types'

const topic: TopicMeta = {
  "key": "servicios",
  "name": "Servicios a pie",
  "short": "Servicios",
  "unit": "minutos a pie a salud, escuela, mercado, transporte",
  "scored": true,
  "color": "#16a34a",
  "order": 7,
  "why": "Tener lo básico a pocos minutos reduce gastos y tiempo de traslado.",
  "ask": [
    "¿Qué transporte usan los vecinos para ir al centro?"
  ],
  "source": "Salud, SEP, SEDECO, Metro/Metrobús, Ecobici, WiFi CDMX",
  "grain": "Punto"
}

export default topic
