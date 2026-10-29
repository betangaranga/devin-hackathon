import type { TopicMeta } from "@/lib/topics";

const topic: TopicMeta = {
  key: "granizo",
  name: "Granizo",
  short: "Granizo",
  unit: "nivel del Atlas de Riesgo por granizo",
  why: "Puede dañar autos estacionados en la calle, domos y tragaluces.",
  ask: ["¿El estacionamiento es techado?"],
  source: "SGIRPC · Atlas de Riesgo (granizo)",
  grain: "Polígono de peligro",
  mapColor: "purple",
  scored: true,
};

export default topic;
