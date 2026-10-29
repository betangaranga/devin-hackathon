import type { TopicMeta } from "@/lib/topics";

const topic: TopicMeta = {
  key: "vial",
  name: "Seguridad vial",
  short: "Seg. vial",
  unit: "incidentes viales a < 500 m (12 meses)",
  why: "Importa si caminas con niños, usas bici o cruzas avenidas a diario.",
  ask: ["¿Hay cruces seguros cerca de la escuela o el transporte?"],
  source: "C5 · Incidentes viales; SSC · Hechos de tránsito",
  grain: "Punto · fecha y hora",
  mapColor: "red",
  scored: true,
};

export default topic;
