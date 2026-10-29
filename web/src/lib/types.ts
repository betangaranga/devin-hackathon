// Tipos de la celda final. Cuando exista contracts/cell.schema.json,
// estos tipos deben generarse o alinearse con ese esquema.

export interface TopicValue {
  /** Métrica cruda reportada por el pipeline (número o etiqueta). */
  metric_raw: number | string;
  /** Etiqueta legible, p. ej. "2.1 reportes / 1,000 hab." */
  metric_label: string;
  /** Percentil 0–100 contra celdas habitadas de la CDMX. Más alto = mejor. */
  score_0_100: number;
  /** Datos extra por tema (series, hotspots, conteos). */
  extra: Record<string, unknown>;
}

export interface NearbyService {
  kind: string;
  /** Minutos a pie al más cercano; null si no hay en el radio analizado. */
  walk_min: number | null;
}

export interface PatrimonioInfo {
  in_zone: boolean;
  label: string;
  nearby_listed: number;
}

export interface CellData {
  /** Índice H3 resolución 9. */
  h3: string;
  /** Centroide de la celda [lng, lat]. */
  center: [number, number];
  label: string;
  colonia: string;
  alcaldia: string;
  /** Un valor por tema: agua, inundacion, granizo, calor, sismo, vial, ruido, servicios. */
  topics: Record<string, TopicValue>;
  patrimonio: PatrimonioInfo;
  services: NearbyService[];
}
