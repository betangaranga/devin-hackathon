export interface Profile {
  label: string;
  short: string;
  /** Pesos por tema; el default es 1. */
  w: Record<string, number>;
}

export const PROFILES: Record<string, Profile> = {
  equilibrado: { label: "Equilibrado", short: "Equilibrado", w: {} },
  familia: { label: "Familia con niños", short: "Familia", w: { servicios: 2, vial: 2, agua: 1.5 } },
  homeoffice: { label: "Trabajo en casa", short: "Home office", w: { ruido: 2.5, agua: 1.5, calor: 1.5 } },
  mayor: { label: "Adulto mayor", short: "Adulto mayor", w: { servicios: 2, calor: 2, sismo: 1.5, vial: 1.5 } },
  sinauto: { label: "Sin auto", short: "Sin auto", w: { servicios: 2.5, vial: 1.5, granizo: 0.3 } },
};

export const DEFAULT_PROFILE = "equilibrado";

/** Puntaje ponderado 0–100 de una celda bajo un perfil. */
export function profileScore(
  scores: Record<string, number>,
  scoredKeys: string[],
  profile: string,
): number {
  const w = (PROFILES[profile] ?? PROFILES[DEFAULT_PROFILE]).w;
  let num = 0;
  let den = 0;
  for (const key of scoredKeys) {
    const wt = w[key] ?? 1;
    num += (scores[key] ?? 0) * wt;
    den += wt;
  }
  return den ? Math.round(num / den) : 0;
}
