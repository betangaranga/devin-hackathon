import { NextRequest } from "next/server";
import { latLngToCell } from "h3-js";

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  h3: string;
}

// BBOX aproximado de la CDMX: [minLng, minLat, maxLng, maxLat]
const CDMX_VIEWBOX = "-99.36,19.60,-98.94,19.04";

async function geocodeNominatim(q: string): Promise<GeocodeResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "mx");
  url.searchParams.set("viewbox", CDMX_VIEWBOX);
  url.searchParams.set("limit", "5");
  const res = await fetch(url, {
    headers: { "User-Agent": "antes-de-rentar/0.1 (datos abiertos CDMX)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((r) => {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    return { label: r.display_name, lat, lng, h3: latLngToCell(lat, lng, 9) };
  });
}

async function geocodeMaptiler(q: string): Promise<GeocodeResult[]> {
  const key = process.env.MAPTILER_KEY;
  if (!key) return [];
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${key}&country=mx&bbox=${CDMX_VIEWBOX}&limit=5`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features: { place_name: string; center: [number, number] }[];
  };
  return data.features.map((f) => {
    const [lng, lat] = f.center;
    return { label: f.place_name, lat, lng, h3: latLngToCell(lat, lng, 9) };
  });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return Response.json({ results: [] });
  }
  const provider = process.env.GEOCODER ?? "nominatim";
  try {
    const results = provider === "maptiler" ? await geocodeMaptiler(q) : await geocodeNominatim(q);
    return Response.json({ results });
  } catch {
    return Response.json({ results: [], error: "geocoder_unavailable" }, { status: 502 });
  }
}
