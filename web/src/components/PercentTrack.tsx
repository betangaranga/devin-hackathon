import { statusColor, statusLabel, statusText } from '../status'

export function PercentTrack({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <div className="rounded-2xl bg-white px-4 py-3 text-xs text-neutral-500">
        Sin datos para este tema en esta zona.
      </div>
    )
  }
  const color = statusColor(score)
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white px-4 pb-3 pt-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-500">Frente a las zonas habitadas de la CDMX</span>
        <span className={`font-semibold ${statusText(score)}`}>{statusLabel(score)}</span>
      </div>
      <div className="relative mt-5 h-9" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Percentil CDMX">
        <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-black/10" />
        <div className="absolute left-0 top-2 h-2 rounded-full" style={{ width: `${score}%`, background: color }} />
        <div className="absolute -top-5 -translate-x-1/2" style={{ left: `${score}%` }}>
          <div className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">{score}</div>
        </div>
        <div className="absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 bg-white" style={{ left: `${score}%`, borderColor: color }} />
        <div className="absolute inset-x-0 top-5 flex justify-between text-[10px] text-neutral-400">
          <span>Peor</span>
          <span>Mediana</span>
          <span>Mejor</span>
        </div>
      </div>
      <p className="text-[11px] text-neutral-500">Mejor que el {score}% de las zonas de la ciudad.</p>
    </div>
  )
}
