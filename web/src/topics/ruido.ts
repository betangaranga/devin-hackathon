import type { TopicMeta } from "@/lib/topics";

const topic: TopicMeta = {
  key: "ruido",
  name: "Ruido",
  short: "Ruido",
  unit: "dB estimados (día / noche)",
  why: "Avenidas, bares y obras cambian mucho la calidad de sueño y el trabajo desde casa.",
  ask: ["¿Las recámaras dan a la calle o al interior?", "¿Ventanas con doble vidrio?"],
  source: "SEDEMA · Contaminación acústica",
  grain: "Polígono / corredor",
  mapColor: "orange",
  scored: true,
};

export default topic;
