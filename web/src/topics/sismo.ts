import type { TopicMeta } from "@/lib/topics";

const topic: TopicMeta = {
  key: "sismo",
  name: "Sismo y reconstrucción",
  short: "Sismo",
  unit: "inmuebles en reconstrucción a < 500 m",
  why: "Edificios cercanos dañados en 2017 indican suelo o construcciones vulnerables en la zona.",
  ask: [
    "¿El edificio tiene dictamen estructural posterior a 2017?",
    "¿Año de construcción?",
    "¿Tiene Director Responsable de Obra registrado?",
  ],
  source: "Comisión para la Reconstrucción · Inmuebles en atención; Padrón de DRO",
  grain: "Punto (inmueble)",
  mapColor: "red",
  scored: true,
};

export default topic;
