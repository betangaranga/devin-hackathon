export interface Level {
  label: "Bien" | "Regular" | "Atención";
  /** Clase Tailwind de color definida en globals.css. */
  color: "green" | "orange" | "red";
}

export function level(score: number): Level {
  if (score >= 67) return { label: "Bien", color: "green" };
  if (score >= 34) return { label: "Regular", color: "orange" };
  return { label: "Atención", color: "red" };
}
