export interface TopicMeta {
  /** Clave del tema; coincide con el archivo en pipeline/topics/ y la capa PMTiles. */
  key: string;
  name: string;
  /** Nombre corto para el mapa y la flor de puntajes. */
  short: string;
  unit: string;
  /** Por qué le importa a quien renta. */
  why: string;
  /** Preguntas sugeridas para la visita al inmueble. */
  ask: string[];
  source: string;
  grain: string;
  /** Color de la capa de calor en el mapa (clase Tailwind ya definida en globals.css). */
  mapColor: "blue" | "red" | "orange" | "purple" | "green";
  /** Si es false, es solo informativo y no entra al puntaje del perfil. */
  scored: boolean;
}
