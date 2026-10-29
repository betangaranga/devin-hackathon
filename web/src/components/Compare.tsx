import { profileScore, type ProfileKey } from '../profiles'
import { AddressSearch } from '../search'
import { statusColor, statusLabel } from '../status'
import { TOPICS } from '../topics'
import type { Address, Cell } from '../types'
import { Flower } from './Flower'
import { Icon } from './icons'
import { cardSummary, matrixSize } from './logic'

export const MAX_COMPARE = 3

export function Compare({
  addresses,
  cells,
  profile,
  onPick,
  onAdd,
  onRemove,
}: {
  addresses: Address[]
  cells: Record<string, Cell | null | undefined>
  profile: ProfileKey
  onPick: (a: Address) => void
  onAdd: (a: Address) => void
  onRemove: (a: Address) => void
}) {
  const cols = `minmax(120px,160px) repeat(${Math.max(addresses.length, 1)}, minmax(90px,1fr))`
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Comparar direcciones ({addresses.length}/{MAX_COMPARE})</h2>
        {addresses.length < MAX_COMPARE && (
          <div className="flex items-center gap-2 text-xs">
            <Icon name="plus" size={14} />
            <span>Agregar:</span>
            <AddressSearch value={addresses[addresses.length - 1] ?? ({} as Address)} onSelect={onAdd} />
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-fit gap-y-2" style={{ gridTemplateColumns: cols }}>
          <span />
          {addresses.map((a) => {
            const cell = cells[a.h3] ?? null
            const s = cell ? profileScore(cell, profile) : null
            return (
              <div key={a.id} className="flex flex-col items-center gap-1 rounded-2xl bg-white p-3">
                <Flower cell={cell} profile={profile} size={120} />
                <span className="max-w-[160px] truncate text-center text-xs font-medium" title={a.label}>{a.colonia ?? a.label}</span>
                <span className="text-[10px] text-neutral-500">{s == null ? 'Sin datos' : `${s}/100 · ${statusLabel(s)}`}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => onPick(a)} className="rounded-full bg-ink px-3 py-1 text-[11px] text-white">Ver reporte</button>
                  {addresses.length > 1 && (
                    <button type="button" onClick={() => onRemove(a)} aria-label={`Quitar ${a.label}`} className="rounded-full bg-panel px-2 py-1 text-neutral-500 hover:text-ink">
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {TOPICS.filter((t) => t.scored).map((t) => (
            <div key={t.key} className="contents">
              <span className="flex items-center gap-2 text-xs text-neutral-600">
                <Icon name={t.key} size={16} />
                {t.short}
              </span>
              {addresses.map((a) => {
                const v = cells[a.h3]?.topics[t.key]
                const d = matrixSize(v?.score)
                return (
                  <div key={a.id} className="flex h-9 items-center justify-center" title={`${t.short}: ${v?.label ?? 'Sin datos'}${v?.score != null ? ` (${v.score}/100)` : ''}`}>
                    <span
                      className="rounded-full"
                      style={{ width: d, height: d, background: v?.score == null ? 'transparent' : statusColor(v.score), border: v?.score == null ? '1px dashed #a3a3a3' : undefined }}
                    />
                    <span className="sr-only">{cardSummary(t.key, v).big}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-neutral-400">Círculo más grande = mejor que más zonas de la ciudad · punteado = sin datos</p>
    </div>
  )
}
