import type { CellData } from "@/lib/types";

// Datos ficticios del prototipo (docs/design/prototipo-dashboard.html).
// Se reemplazan por web/public/data/cells/<h3_res6>.json cuando exista el pipeline.
export const FIXTURE_CELLS: CellData[] = [
  {
    h3: "894995ba62fffff",
    center: [-99.1553, 19.3956],
    label: "Calle Ejemplo 120, Col. Narvarte",
    colonia: "Narvarte",
    alcaldia: "Benito Juárez (ejemplo)",
    topics: {
      agua: {
        metric_raw: 2.1,
        metric_label: "2.1 reportes / 1,000 hab.",
        score_0_100: 78,
        extra: { monthly: [0.1, 0.1, 0.3, 0.4, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2] },
      },
      inundacion: { metric_raw: 3, metric_label: "Peligro medio-alto", score_0_100: 35, extra: {} },
      granizo: { metric_raw: 2, metric_label: "Peligro medio", score_0_100: 55, extra: {} },
      calor: { metric_raw: 17.9, metric_label: "17.9 °C", score_0_100: 62, extra: {} },
      sismo: { metric_raw: 6, metric_label: "6 inmuebles", score_0_100: 30, extra: {} },
      vial: {
        metric_raw: 84,
        metric_label: "84 incidentes",
        score_0_100: 41,
        extra: {
          monthly: [6, 7, 5, 8, 9, 7, 6, 8, 7, 6, 8, 7],
          hotspots: [
            { name: "Av. Principal y Eje 5", n: 23 },
            { name: "Av. Principal y Calle 9", n: 11 },
            { name: "Eje 5 y Calle Roble", n: 7 },
          ],
        },
      },
      ruido: { metric_raw: "71/63", metric_label: "71 dB / 63 dB", score_0_100: 38, extra: {} },
      servicios: { metric_raw: 12, metric_label: "Todo a < 12 min", score_0_100: 91, extra: {} },
    },
    patrimonio: {
      in_zone: true,
      label: "Dentro de un área de conservación patrimonial: remodelaciones de fachada requieren permiso de SEDUVI.",
      nearby_listed: 0,
    },
    services: [
      { kind: "Centro de salud", walk_min: 6 },
      { kind: "Escuela primaria pública", walk_min: 4 },
      { kind: "Mercado público", walk_min: 9 },
      { kind: "Metro / Metrobús", walk_min: 7 },
      { kind: "Cicloestación Ecobici", walk_min: 3 },
      { kind: "WiFi gratuito", walk_min: 2 },
    ],
  },
  {
    h3: "894995ba353ffff",
    center: [-99.161, 19.421],
    label: "Calle Ficticia 45, Col. Roma Norte",
    colonia: "Roma Norte",
    alcaldia: "Cuauhtémoc (ejemplo)",
    topics: {
      agua: {
        metric_raw: 3.4,
        metric_label: "3.4 reportes / 1,000 hab.",
        score_0_100: 64,
        extra: { monthly: [0.2, 0.2, 0.4, 0.5, 0.5, 0.3, 0.2, 0.2, 0.2, 0.3, 0.2, 0.2] },
      },
      inundacion: { metric_raw: 1, metric_label: "Peligro bajo", score_0_100: 80, extra: {} },
      granizo: { metric_raw: 1, metric_label: "Peligro bajo", score_0_100: 70, extra: {} },
      calor: { metric_raw: 18.6, metric_label: "18.6 °C", score_0_100: 40, extra: {} },
      sismo: { metric_raw: 1, metric_label: "1 inmueble", score_0_100: 68, extra: {} },
      vial: {
        metric_raw: 131,
        metric_label: "131 incidentes",
        score_0_100: 22,
        extra: {
          monthly: [10, 12, 9, 11, 13, 12, 10, 11, 12, 10, 11, 10],
          hotspots: [
            { name: "Eje Central y Av. Juárez (ej.)", n: 38 },
            { name: "Eje Central y Calle 3", n: 19 },
            { name: "Calle 3 y Calle 7", n: 9 },
          ],
        },
      },
      ruido: { metric_raw: "76/69", metric_label: "76 dB / 69 dB", score_0_100: 18, extra: {} },
      servicios: { metric_raw: 15, metric_label: "Casi todo a < 15 min", score_0_100: 84, extra: {} },
    },
    patrimonio: {
      in_zone: false,
      label: "Fuera de áreas de conservación patrimonial; 2 inmuebles catalogados a menos de 300 m.",
      nearby_listed: 2,
    },
    services: [
      { kind: "Centro de salud", walk_min: 11 },
      { kind: "Escuela primaria pública", walk_min: 8 },
      { kind: "Mercado público", walk_min: 5 },
      { kind: "Metro / Metrobús", walk_min: 4 },
      { kind: "Cicloestación Ecobici", walk_min: 5 },
      { kind: "WiFi gratuito", walk_min: 1 },
    ],
  },
  {
    h3: "8949958ea87ffff",
    center: [-99.055, 19.357],
    label: "Calle Modelo 8, Col. Iztapalapa",
    colonia: "Iztapalapa",
    alcaldia: "Iztapalapa (ejemplo)",
    topics: {
      agua: {
        metric_raw: 14.8,
        metric_label: "14.8 reportes / 1,000 hab.",
        score_0_100: 12,
        extra: { monthly: [0.6, 0.8, 1.6, 2.4, 2.6, 1.9, 0.9, 0.7, 0.8, 0.9, 0.8, 0.8] },
      },
      inundacion: { metric_raw: 4, metric_label: "Peligro alto", score_0_100: 20, extra: {} },
      granizo: { metric_raw: 3, metric_label: "Peligro medio-alto", score_0_100: 40, extra: {} },
      calor: { metric_raw: 19.4, metric_label: "19.4 °C", score_0_100: 28, extra: {} },
      sismo: { metric_raw: 3, metric_label: "3 inmuebles", score_0_100: 45, extra: {} },
      vial: {
        metric_raw: 39,
        metric_label: "39 incidentes",
        score_0_100: 66,
        extra: {
          monthly: [3, 4, 3, 2, 4, 3, 4, 3, 4, 3, 3, 3],
          hotspots: [
            { name: "Av. Oriente y Calle 12", n: 9 },
            { name: "Av. Oriente y Calle 20", n: 6 },
            { name: "Calle 12 y Calle Sur", n: 3 },
          ],
        },
      },
      ruido: { metric_raw: "62/52", metric_label: "62 dB / 52 dB", score_0_100: 74, extra: {} },
      servicios: { metric_raw: 22, metric_label: "Metro a 22 min", score_0_100: 46, extra: {} },
    },
    patrimonio: {
      in_zone: false,
      label: "Fuera de áreas de conservación patrimonial.",
      nearby_listed: 0,
    },
    services: [
      { kind: "Centro de salud", walk_min: 14 },
      { kind: "Escuela primaria pública", walk_min: 6 },
      { kind: "Mercado sobre ruedas (mar y sáb)", walk_min: 8 },
      { kind: "Metro / Metrobús", walk_min: 22 },
      { kind: "Cicloestación Ecobici", walk_min: null },
      { kind: "WiFi gratuito", walk_min: 4 },
    ],
  },
];
