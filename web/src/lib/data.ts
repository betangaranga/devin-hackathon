import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cellToParent, isValidCell, getResolution } from "h3-js";
import type { CellData } from "@/lib/types";
import { FIXTURE_CELLS } from "@/fixtures/cells";

const FIXTURE_BY_H3 = new Map(FIXTURE_CELLS.map((c) => [c.h3, c]));

/** Shard del pipeline: public/data/cells/<h3_res6>.json agrupa celdas res 9. */
async function readShard(res6: string): Promise<Record<string, CellData> | null> {
  try {
    const file = path.join(process.cwd(), "public", "data", "cells", `${res6}.json`);
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

export const getCell = cache(async (h3: string): Promise<CellData | null> => {
  if (!isValidCell(h3) || getResolution(h3) !== 9) {
    const fixture = FIXTURE_BY_H3.get(h3);
    return fixture ?? null;
  }
  const shard = await readShard(cellToParent(h3, 6));
  return shard?.[h3] ?? FIXTURE_BY_H3.get(h3) ?? null;
});

/** Busca la celda fixture cuyo centroide contiene (o está más cerca de) el punto. */
export function nearestFixtureCell(lat: number, lng: number): CellData | null {
  let best: CellData | null = null;
  let bestD = Infinity;
  for (const c of FIXTURE_CELLS) {
    const d = (c.center[0] - lng) ** 2 + (c.center[1] - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function listFixtureCells(): CellData[] {
  return FIXTURE_CELLS;
}
