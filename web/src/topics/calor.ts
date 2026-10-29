import type { TopicMeta } from "@/lib/topics";

const topic: TopicMeta = {
  key: "calor",
  name: "Calor",
  short: "Calor",
  unit: "temperatura media anual de la zona",
  why: "Zonas más calientes y con poco arbolado elevan la temperatura interior en primavera.",
  ask: ["¿Último piso o con azotea expuesta?", "¿Tiene ventilación cruzada?"],
  source: "SEDEMA · Zonas de temperatura media anual",
  grain: "Polígono",
  mapColor: "orange",
  scored: true,
};

export default topic;
