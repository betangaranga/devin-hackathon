import type { TopicMeta } from "@/lib/topics";

const topic: TopicMeta = {
  key: "servicios",
  name: "Servicios a pie",
  short: "Servicios",
  unit: "minutos caminando a servicios básicos",
  why: "Tener salud, escuela, mercado y transporte a 15 minutos ahorra tiempo y dinero cada día.",
  ask: [],
  source: "Centros de salud, Escuelas públicas, Mercados, Metro/Metrobús, Ecobici, WiFi CDMX",
  grain: "Punto",
  mapColor: "green",
  scored: true,
};

export default topic;
