import type { TopicMeta } from "@/lib/topics";

const topic: TopicMeta = {
  key: "agua",
  name: "Abasto de agua",
  short: "Agua",
  unit: "reportes de falta de agua por 1,000 hab. (12 meses)",
  why: "Las colonias con tandeo o fugas frecuentes pasan días sin agua en temporada seca (mar–may).",
  ask: [
    "¿Tiene cisterna y tinaco? ¿De qué capacidad?",
    "¿Cuántos días a la semana llega el agua?",
    "¿Hay sistema de captación de lluvia (SCALL)?",
  ],
  source: "SACMEX · Reportes de agua, Consumo de agua por colonia",
  grain: "Colonia · mensual",
  mapColor: "blue",
  scored: true,
};

export default topic;
