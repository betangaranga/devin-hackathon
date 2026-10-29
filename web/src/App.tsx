import { useEffect, useMemo, useState } from 'react'
import { Compare, MAX_COMPARE } from './components/Compare'
import { Flower } from './components/Flower'
import { Icon } from './components/icons'
import { AskLandlord } from './components/AskLandlord'
import { PercentTrack } from './components/PercentTrack'
import { Segmented } from './components/Segmented'
import { TopicCard } from './components/TopicCard'
import { TopicDetail } from './components/TopicDetail'
import { verdict } from './components/logic'
import { getCell, SAMPLE_ADDRESSES, USE_FIXTURES } from './data'
import { CityMap } from './map'
import { PROFILE_KEYS, PROFILES, profileScore, type ProfileKey } from './profiles'
import { AddressSearch } from './search'
import { useReportUrlState, whatsappLink } from './share'
import { statusText } from './status'
import { SCORED_TOPICS, TOPIC_BY_KEY } from './topics'
import type { Address, Cell, TopicKey } from './types'

type View = 'reporte' | 'comparar'

export default function App() {
  const [report, updateReport] = useReportUrlState(
    { address: SAMPLE_ADDRESSES[0], profile: 'equilibrado', topic: 'servicios', compare: SAMPLE_ADDRESSES.slice(0, MAX_COMPARE) },
    SAMPLE_ADDRESSES,
  )
  const { address: addr, profile, topic, compare } = report
  const setAddr = (address: Address) => updateReport({ address })
  const setProfile = (p: ProfileKey) => updateReport({ profile: p })
  const setTopic = (t: TopicKey) => updateReport({ topic: t })
  const [view, setView] = useState<View>('reporte')
  const [cells, setCells] = useState<Record<string, Cell | null>>({})

  const wanted = useMemo(() => [...new Set([addr.h3, ...compare.map((a) => a.h3)])], [addr.h3, compare])
  useEffect(() => {
    let alive = true
    for (const h3 of wanted) {
      if (h3 in cells) continue
      getCell(h3).then((c) => alive && setCells((prev) => ({ ...prev, [h3]: c })))
    }
    return () => {
      alive = false
    }
  }, [wanted, cells])

  const cell = cells[addr.h3] ?? null
  const loading = !(addr.h3 in cells)
  const meta = TOPIC_BY_KEY[topic]
  const value = cell?.topics[topic]
  const score = cell ? profileScore(cell, profile) : null
  const v = cell ? verdict(cell) : { best: [], worst: [] }
  const share = whatsappLink({ address: addr, profile, topic, compare })

  const pick = (a: Address) => {
    setAddr(a)
    setView('reporte')
  }
  const addCompare = (a: Address) => {
    if (!compare.some((x) => x.id === a.id) && compare.length < MAX_COMPARE) updateReport({ compare: [...compare, a] })
  }
  const removeCompare = (a: Address) => updateReport({ compare: compare.filter((x) => x.id !== a.id) })

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      {USE_FIXTURES && (
        <div role="note" className="bg-regular px-4 py-1 text-center text-[11px] font-medium text-white">
          Datos ficticios: esta versión usa fixtures de ejemplo, no datos reales de la CDMX.
        </div>
      )}
      <header className="flex flex-wrap items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Antes de rentar</h1>
        <div className="min-w-0 flex-1 basis-60">
          <AddressSearch value={addr} onSelect={setAddr} className="w-full" />
        </div>
        <Segmented<View>
          ariaLabel="Vista"
          value={view}
          onChange={setView}
          options={[
            { value: 'reporte', label: 'Reporte' },
            { value: 'comparar', label: 'Comparar' },
          ]}
        />
        <div className="max-w-full overflow-x-auto">
          <Segmented<ProfileKey> ariaLabel="Perfil" value={profile} onChange={setProfile} options={PROFILE_KEYS.map((k) => ({ value: k, label: PROFILES[k].short }))} />
        </div>
      </header>

      {view === 'comparar' ? (
        <main className="flex-1 overflow-y-auto">
          <Compare addresses={compare} cells={cells} profile={profile} onPick={pick} onAdd={addCompare} onRemove={removeCompare} />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(380px,1fr)_minmax(0,1.35fr)]">
          <section className="order-1 flex h-[50vh] flex-col gap-3 p-3 lg:order-2 lg:h-auto lg:min-h-0">
            <CityMap className="min-h-0 flex-1" address={addr} cell={cell} topic={topic} />
            <a
              href={share}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white hover:bg-black"
            >
              <Icon name="share" size={18} />
              Compartir reporte por WhatsApp
            </a>
          </section>

          <aside className="order-2 flex min-w-0 flex-col gap-3 p-3 lg:order-1 lg:overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-neutral-500">Cargando reporte…</p>
            ) : !cell ? (
              <p className="rounded-2xl bg-white p-4 text-sm text-neutral-500">Sin datos para esta dirección todavía.</p>
            ) : (
              <>
                <div className="flex items-center gap-4 rounded-2xl bg-white p-3">
                  <Flower cell={cell} profile={profile} size={96} selected={topic} onSelect={setTopic} showScore={false} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[11px] text-neutral-500">Puntaje para ti · {PROFILES[profile].label}</span>
                    <span className="text-sm">
                      <span className={`text-4xl font-light leading-none ${statusText(score)}`}>{score ?? '–'}</span>
                      <span className="text-neutral-400"> / 100</span>
                    </span>
                    <span className="truncate text-[11px] text-neutral-500">
                      {[cell.colonia ?? addr.colonia, cell.cp ?? addr.cp, cell.alcaldia].filter(Boolean).join(' · ')}
                    </span>
                    {v.best.length > 0 && (
                      <span className="text-[11px] text-neutral-600"><span className="text-bien">Destaca:</span> {v.best.join(', ')}</span>
                    )}
                    {v.worst.length > 0 && (
                      <span className="text-[11px] text-neutral-600"><span className="text-atencion">Revisa:</span> {v.worst.join(', ')}</span>
                    )}
                  </div>
                </div>

                <div className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
                  {SCORED_TOPICS.map((t) => (
                    <div key={t.key} className="shrink-0 snap-start lg:shrink">
                      <TopicCard meta={t} value={cell.topics[t.key]} selected={topic === t.key} onClick={() => setTopic(t.key)} />
                    </div>
                  ))}
                </div>

                {cell.topics.patrimonio && (
                  <button
                    type="button"
                    onClick={() => setTopic('patrimonio')}
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-left text-[11px] ${topic === 'patrimonio' ? 'bg-ink text-white' : 'bg-white text-neutral-600'}`}
                  >
                    <Icon name="patrimonio" size={16} className="text-purple-600" />
                    {cell.topics.patrimonio.label ?? 'Patrimonio'} (informativo, no entra al puntaje)
                  </button>
                )}

                {meta.scored && <PercentTrack score={value?.score} />}
                <TopicDetail key={topic} meta={meta} value={value} cell={cell} />
                <AskLandlord key={`ask-${topic}`} questions={meta.ask} />
              </>
            )}
            <footer className="mt-auto px-1 text-[10px] text-neutral-400">
              {USE_FIXTURES ? 'Datos y mapa ficticios. ' : ''}Fuente del tema: {meta.source}. Puntaje 0–100 = percentil frente a las zonas habitadas de la CDMX.
            </footer>
          </aside>
        </main>
      )}
    </div>
  )
}
