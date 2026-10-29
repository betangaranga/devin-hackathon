import type { ReactNode } from 'react'

const PATHS: Record<string, ReactNode> = {
  agua: <path d="M12 3c3.5 4.5 6 7.6 6 10.5A6 6 0 0 1 6 13.5C6 10.6 8.5 7.5 12 3z" />,
  inundacion: <path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />,
  sismo: <path d="M5 21V6l7-3 7 3v15M3 21h18M12 3v5l-2 3 3 3-2 3 1 4" />,
  vial: <path d="M4 16h16v-3l-2-5H6l-2 5v3zM4 13h16M7 19.5a1.5 1.5 0 1 0 0-3M17 19.5a1.5 1.5 0 1 0 0-3M7 16.5v3M17 16.5v3" />,
  ruido: <path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />,
  calor: (
    <g>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </g>
  ),
  granizo: (
    <g>
      <path d="M7 14a4 4 0 0 1 .5-8A5 5 0 0 1 17 7a3.5 3.5 0 0 1 0 7H7z" />
      <circle cx="8" cy="18" r="1" />
      <circle cx="12" cy="20.5" r="1" />
      <circle cx="16" cy="18" r="1" />
    </g>
  ),
  servicios: (
    <g>
      <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />
      <circle cx="12" cy="10" r="2" />
    </g>
  ),
  patrimonio: <path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18" />,
  salud: <path d="M12 5v14M5 12h14" />,
  escuela: <path d="M3 9l9-4 9 4-9 4-9-4zM7 11v4c3 2 7 2 10 0v-4" />,
  mercado: <path d="M5 9h14l-1.5 9h-11L5 9zM9 9l3-5 3 5" />,
  transporte: <path d="M7 4h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM5 11h14M9 21l1-4M15 21l-1-4" />,
  ecobici: (
    <g>
      <circle cx="6" cy="16" r="3" />
      <circle cx="18" cy="16" r="3" />
      <path d="M6 16l4-7h5l3 7M10 9l2 7h-6" />
    </g>
  ),
  wifi: (
    <g>
      <path d="M4 9a12 12 0 0 1 16 0M7 12.5a7.5 7.5 0 0 1 10 0M10 16a3 3 0 0 1 4 0" />
      <circle cx="12" cy="19" r="0.8" />
    </g>
  ),
  share: <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1zM9 9.5c0 3 2.5 5.5 5.5 5.5l1.5-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2L9 9.5z" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
}

export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.servicios}
    </svg>
  )
}
