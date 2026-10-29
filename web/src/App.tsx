import { useEffect, useState } from 'react'
import { getCell, SAMPLE_ADDRESSES, USE_FIXTURES } from './data'
import { CityMap } from './map'
import { AddressSearch } from './search'
import { PROFILES, profileScore, type ProfileKey } from './profiles'
import { STATUS_LABEL, status } from './status'
import { TOPICS } from './topics'
import type { Cell } from './types'

// Placeholder shell from phase 0. F1 replaces this with the dashboard (docs/design/prototipo-dashboard.html).
export default function App() {
  const [addr, setAddr] = useState(SAMPLE_ADDRESSES[0])
  const [profile, setProfile] = useState<ProfileKey>('equilibrado')
  const [cell, setCell] = useState<Cell | null>(null)

  useEffect(() => {
    getCell(addr.h3).then(setCell)
  }, [addr.h3])

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-semibold">Antes de rentar</h1>
      {USE_FIXTURES && <p className="text-sm text-regular">Datos ficticios (fixtures).</p>}
      <div className="my-4 flex gap-2">
        <AddressSearch value={addr} onSelect={setAddr} />
        <select className="rounded-full bg-ink px-3 py-1 text-white" value={profile} onChange={(e) => setProfile(e.target.value as ProfileKey)}>
          {Object.entries(PROFILES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
      </div>
      {cell && (
        <>
          <p className="text-5xl font-semibold">{profileScore(cell, profile) ?? '–'}</p>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {TOPICS.map((t) => {
              const v = cell.topics[t.key]
              const st = status(v?.score)
              return (
                <li key={t.key} className="rounded-2xl bg-white p-3">
                  <div className="text-sm text-gray-500">{t.name}</div>
                  <div className="font-medium">{v?.label ?? 'Sin datos'}</div>
                  {st && <div className={`text-xs text-${st}`}>{STATUS_LABEL[st]} · {v?.score}</div>}
                </li>
              )
            })}
          </ul>
          <CityMap className="mt-4 h-64" address={addr} cell={cell} topic="vial" />
        </>
      )}
    </main>
  )
}
