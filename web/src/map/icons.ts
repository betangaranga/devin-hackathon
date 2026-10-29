import type { PointKind } from './layers'

// 24×24 stroke icons (same family as the design prototype), rendered white on a black disc.
const PATHS: Record<PointKind, string> = {
  salud: '<path d="M12 6v12M6 12h12"/>',
  escuela: '<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>',
  mercado: '<path d="M4 7h16l-1.5 6H5.5L4 7z"/><path d="M4 7l-1-3M8 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>',
  transporte: '<rect x="6" y="4" width="12" height="13" rx="2"/><path d="M6 11h12M9 20l-1.5-3M15 20l1.5-3"/>',
  ecobici: '<circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><path d="M6 16l4-7h5l3 7M10 9l2 7h-6"/>',
  wifi: '<path d="M4 9a12 12 0 0 1 16 0M7 12.5a7.5 7.5 0 0 1 10 0M10 16a3 3 0 0 1 4 0"/><circle cx="12" cy="19" r="0.8"/>',
  sismo: '<path d="M3 12h4l2-5 3 10 2-5h7"/>',
  vial: '<path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 17v.5"/>',
  otro: '<circle cx="12" cy="12" r="3"/>',
}

export function iconSvg(kind: PointKind, size = 16): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[kind] ?? PATHS.otro}</svg>`
}

export const KIND_LABEL: Record<PointKind, string> = {
  salud: 'Salud',
  escuela: 'Escuela',
  mercado: 'Mercado',
  transporte: 'Transporte',
  ecobici: 'Ecobici',
  wifi: 'WiFi',
  sismo: 'Inmueble',
  vial: 'Punto conflictivo',
  otro: 'Servicio',
}
