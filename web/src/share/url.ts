/** Estado compartible del reporte en la URL: /reporte/<h3>?perfil=x&tema=y */

export function reportPath(h3: string, opts?: { perfil?: string; tema?: string }): string {
  const params = new URLSearchParams();
  if (opts?.perfil) params.set("perfil", opts.perfil);
  if (opts?.tema) params.set("tema", opts.tema);
  const qs = params.toString();
  return `/reporte/${h3}${qs ? `?${qs}` : ""}`;
}

export function whatsappShareUrl(h3: string, label: string, origin: string): string {
  const url = `${origin}${reportPath(h3)}`;
  const text = `Reporte de ${label} — Antes de rentar: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
