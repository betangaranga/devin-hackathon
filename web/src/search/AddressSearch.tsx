"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GeocodeResult } from "@/app/api/geocode/route";

export function AddressSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  const query = q.trim();
  const visibleResults = query.length < 3 ? [] : results;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.length < 3) return;
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as { results: GeocodeResult[] };
        setResults(data.results);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => visibleResults.length && setOpen(true)}
        placeholder="Escribe una dirección, colonia o código postal…"
        className="w-full rounded-full border border-border bg-card px-5 py-3 text-sm shadow-sm outline-none focus:border-foreground"
        aria-label="Buscar dirección"
      />
      {loading && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-tertiary">…</span>
      )}
      {open && visibleResults.length > 0 && (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          {visibleResults.map((r) => (
            <li key={`${r.h3}-${r.label}`}>
              <button
                type="button"
                className="w-full px-5 py-3 text-left text-sm hover:bg-wash"
                onClick={() => {
                  setOpen(false);
                  router.push(`/reporte/${r.h3}`);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
