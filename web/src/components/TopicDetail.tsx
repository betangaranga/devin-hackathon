import { statusColor } from '../status'
import type { Cell, TopicMeta, TopicValue } from '../types'
import { Icon } from './icons'
import { HAZARD_LEVELS, monthLabels, num, numArray, objArray, seriesSummary, SERVICE_LABEL, walkList } from './logic'

const SEASON: Record<string, string> = { inundacion: 'Temporada: jun–sep', granizo: 'Temporada: may–ago' }

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-light leading-tight">{v}</span>
      <span className="text-[10px] text-neutral-500">{l}</span>
    </div>
  )
}

function MonthlyBars({ series, reference, labels, color, refLabel }: { series: number[]; reference?: number[] | null; labels: string[]; color: string; refLabel?: string }) {
  const max = Math.max(...series, ...(reference ?? []), 1e-9)
  const W = 480
  const H = 80
  const bw = W / series.length
  const refPts = reference?.length === series.length ? reference.map((r, i) => `${i * bw + bw / 2},${H - (r / max) * H}`).join(' ') : null
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="h-auto w-full" role="img" aria-label="Serie mensual">
        {series.map((v, i) => (
          <rect key={i} x={i * bw + 4} y={H - (v / max) * H} width={bw - 8} height={(v / max) * H} rx={2} fill={color} fillOpacity={0.85} />
        ))}
        {refPts && <polyline points={refPts} fill="none" stroke="#0b0b0c" strokeWidth={1.5} strokeDasharray="3 3" />}
        {labels.map((l, i) => (
          <text key={i} x={i * bw + bw / 2} y={H + 12} textAnchor="middle" fontSize={10} fill="#737373">
            {l}
          </text>
        ))}
      </svg>
      {refPts && (
        <div className="flex gap-3 text-[10px] text-neutral-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: color }} />Esta zona</span>
          <span className="flex items-center gap-1"><span className="w-3 border-t border-dashed border-ink" />{refLabel ?? 'CDMX'}</span>
        </div>
      )}
    </div>
  )
}

function Body({ meta, value, cell }: { meta: TopicMeta; value: TopicValue; cell: Cell }) {
  const x = value.extra ?? {}
  const color = statusColor(value.score)
  const labels = monthLabels(cell.updated_at)
  switch (meta.key) {
    case 'agua': {
      const m = numArray(x.monthly)
      const city = numArray(x.city_monthly)
      if (!m) return null
      const s = seriesSummary(m, labels, city)
      return (
        <>
          <div className="flex gap-6">
            <Stat v={s.peakLabel} l="mes más crítico" />
            {s.ratio != null && <Stat v={`${s.ratio.toFixed(1)}×`} l="vs. promedio CDMX" />}
          </div>
          <MonthlyBars series={m} reference={city} labels={labels} color={color} refLabel="Promedio CDMX" />
        </>
      )
    }
    case 'vial': {
      const m = numArray(x.monthly)
      const ratio = num(x.city_ratio)
      const hot = objArray<{ name: string; n: number }>(x.hotspots).slice(0, 3)
      const maxN = Math.max(...hot.map((h) => h.n), 1)
      return (
        <>
          <div className="flex gap-6">
            {value.raw != null && <Stat v={String(value.raw)} l="incidentes / año" />}
            {ratio != null && <Stat v={`${ratio.toFixed(1)}×`} l="vs. promedio CDMX" />}
          </div>
          {m && <MonthlyBars series={m} labels={labels} color={color} />}
          {hot.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium">Cruces con más incidentes</span>
              {hot.map((h) => (
                <div key={h.name} className="flex items-center gap-2 text-[11px]">
                  <span className="w-40 shrink-0 truncate" title={h.name}>{h.name}</span>
                  <span className="h-1.5 rounded-full" style={{ width: `${(h.n / maxN) * 100}%`, maxWidth: '50%', background: color }} />
                  <span className="text-neutral-500">{h.n}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )
    }
    case 'servicios': {
      const list = walkList(value)
      return (
        <ul className="flex flex-col gap-1.5">
          {list.map((s) => {
            const m = num(s.minutes)
            return (
              <li key={s.kind} className="flex items-center gap-2 text-[11px]">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${m == null ? 'bg-panel text-neutral-400' : 'bg-ink text-white'}`}>
                  <Icon name={s.kind} size={13} />
                </span>
                <span className="w-32 shrink-0 truncate" title={s.name}>{SERVICE_LABEL[s.kind] ?? s.name}</span>
                <span className="relative h-1.5 flex-1 rounded-full bg-black/10">
                  {m != null && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(m, 30) / 30 * 100}%`, background: statusColor(m <= 10 ? 100 : m <= 15 ? 50 : 0) }} />}
                  <span className="absolute -top-1 h-3.5 border-l border-dashed border-ink/50" style={{ left: '50%' }} title="15 min" />
                </span>
                <span className="w-12 text-right text-neutral-600">{m == null ? 'No hay' : `${m} min`}</span>
              </li>
            )
          })}
          <li className="text-[10px] text-neutral-400">Línea punteada = 15 min a pie</li>
        </ul>
      )
    }
    case 'inundacion':
    case 'granizo': {
      const lvl = num(value.raw)
      return (
        <>
          <div className="grid grid-cols-4 gap-1">
            {HAZARD_LEVELS.map((l, i) => (
              <div key={l} className="flex flex-col items-center gap-1">
                <span className="h-2 w-full rounded-full" style={{ background: lvl != null && i < lvl ? color : '#e5e5e5' }} />
                <span className={`text-[10px] ${lvl === i + 1 ? 'font-semibold' : 'text-neutral-400'}`}>{l}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">{String(x.level_label ?? value.label ?? '')} · {SEASON[meta.key]}</p>
        </>
      )
    }
    case 'calor': {
      const t = num(value.raw)
      const lo = num(x.city_min)
      const hi = num(x.city_max)
      if (t == null || lo == null || hi == null || hi <= lo) return null
      const pos = Math.min(Math.max((t - lo) / (hi - lo), 0), 1) * 100
      return (
        <div className="flex flex-col gap-1">
          <div className="relative h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#60a5fa,#facc15,#dc2626)' }}>
            <span className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-ink bg-white" style={{ left: `${pos}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-neutral-500">
            <span>{lo}° (más fresco CDMX)</span>
            <span>{hi}° (más cálido)</span>
          </div>
        </div>
      )
    }
    case 'sismo': {
      const near = objArray<{ name: string; status?: string }>(x.nearby)
      if (!near.length) return <p className="text-[11px] text-neutral-500">Sin inmuebles en reconstrucción a menos de 500 m.</p>
      return (
        <ul className="flex flex-col gap-1 text-[11px]">
          {near.map((b, i) => (
            <li key={`${b.name}-${i}`} className="flex justify-between gap-2">
              <span className="truncate">{b.name}</span>
              <span className="shrink-0 text-neutral-500">{b.status}</span>
            </li>
          ))}
        </ul>
      )
    }
    case 'ruido': {
      const day = num(value.raw)
      const night = num(x.db_night)
      const rows = [
        { l: 'Día', v: day, ref: 53 },
        { l: 'Noche', v: night, ref: 45 },
      ]
      return (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <div key={r.l} className="flex items-center gap-2 text-[11px]">
              <span className="w-10">{r.l}</span>
              <span className="relative h-2 flex-1 rounded-full bg-black/10">
                {r.v != null && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(r.v / 90, 1) * 100}%`, background: color }} />}
                <span className="absolute -top-1 h-4 border-l border-dashed border-ink" style={{ left: `${(r.ref / 90) * 100}%` }} />
              </span>
              <span className="w-12 text-right">{r.v == null ? '–' : `${r.v} dB`}</span>
            </div>
          ))}
          <span className="text-[10px] text-neutral-400">Línea punteada = guía OMS para tráfico (53 dB día, 45 dB noche)</span>
        </div>
      )
    }
    case 'patrimonio': {
      const zone = typeof x.zone_name === 'string' ? x.zone_name : null
      const cat = num(x.catalogados_300m)
      return (
        <p className="text-[11px] text-neutral-600">
          {value.raw ? `Dentro de ${zone ?? 'un área de conservación patrimonial'}: remodelar la fachada requiere permiso de SEDUVI.` : 'Fuera de áreas de conservación patrimonial.'}
          {cat != null && ` ${cat} inmuebles catalogados a menos de 300 m.`}
        </p>
      )
    }
  }
}

export function TopicDetail({ meta, value, cell }: { meta: TopicMeta; value: TopicValue | undefined; cell: Cell }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{meta.name}</h2>
        <p className="text-[11px] text-neutral-500">{meta.why}</p>
      </header>
      {value ? <Body meta={meta} value={value} cell={cell} /> : <p className="text-[11px] text-neutral-500">Sin datos para este tema todavía.</p>}
      <p className="text-[10px] text-neutral-400">{meta.unit} · Fuente: {meta.source} · {meta.grain}</p>
    </section>
  )
}
