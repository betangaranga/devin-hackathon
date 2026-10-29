import { ImageResponse } from "next/og";
import { getCell } from "@/lib/data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BARS = [
  ["agua", "Agua"],
  ["inundacion", "Inundación"],
  ["sismo", "Sismo"],
  ["vial", "Seg. vial"],
  ["ruido", "Ruido"],
  ["calor", "Calor"],
  ["granizo", "Granizo"],
  ["servicios", "Servicios"],
] as const;

function barColor(s: number) {
  return s >= 67 ? "#16a34a" : s >= 34 ? "#ea8a00" : "#dc2626";
}

export default async function Image({ params }: { params: Promise<{ h3: string }> }) {
  const { h3 } = await params;
  const cell = await getCell(h3);

  if (!cell) {
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
        Antes de rentar
      </div>,
    );
  }

  const scored = BARS.map(([k]) => cell.topics[k]?.score_0_100 ?? 0);
  const total = Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#f7f6f3",
        padding: 64,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, color: "#6b6a64" }}>Antes de rentar</div>
      <div style={{ display: "flex", marginTop: 8, fontSize: 52, fontWeight: 700, color: "#1a1a18" }}>
        {cell.label}
      </div>
      <div style={{ display: "flex", fontSize: 24, color: "#6b6a64" }}>
        {cell.colonia} · {cell.alcaldia}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "flex-end", gap: 24, marginTop: 32 }}>
        {BARS.map(([key, name], i) => {
          const s = scored[i];
          return (
            <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: barColor(s) }}>{s}</div>
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: Math.max(8, (s / 100) * 260),
                  background: barColor(s),
                  borderRadius: 8,
                  marginTop: 8,
                }}
              />
              <div style={{ display: "flex", marginTop: 12, fontSize: 18, color: "#6b6a64" }}>{name}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: 24, fontSize: 30, fontWeight: 700, color: barColor(total) }}>
        Puntaje general: {total}/100
      </div>
    </div>,
  );
}
