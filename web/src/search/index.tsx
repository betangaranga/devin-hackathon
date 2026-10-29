import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { SAMPLE_ADDRESSES } from '../data'
import type { Address } from '../types'
import { createGeocoder, inCdmx, loadLocalIndex, NOMINATIM_DEBOUNCE_MS, searchLocal, toAddress, type IndexEntry, type SearchResult } from './geocode'

export interface AddressSearchProps {
  value: Address
  onSelect: (address: Address) => void
  className?: string
}

const geocode = createGeocoder()
const NO_RESULTS: SearchResult[] = []
let indexPromise: Promise<IndexEntry[]> | null = null
function getIndex() {
  indexPromise ??= loadLocalIndex(`${import.meta.env.BASE_URL}data/search/index.json`)
  return indexPromise
}

const KIND_LABEL: Record<SearchResult['kind'], string> = {
  direccion: 'Ejemplo',
  colonia: 'Colonia',
  cp: 'CP',
  osm: 'Dirección',
  ubicacion: 'Ubicación',
}

export function AddressSearch({ value, onSelect, className }: AddressSearchProps) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [index, setIndex] = useState<IndexEntry[]>([])
  const [remote, setRemote] = useState<{ q: string; results: SearchResult[]; error?: string }>({ q: '', results: [] })
  const [geoError, setGeoError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getIndex().then(setIndex)
  }, [])

  const local = useMemo(() => (query.trim() ? searchLocal(query, SAMPLE_ADDRESSES, index) : SAMPLE_ADDRESSES.map((a) => searchLocal(a.label, [a], [])[0])), [query, index])

  const q = query.trim()
  const eligible = q.length >= 4 && !/^\d+$/.test(q)
  useEffect(() => {
    if (!eligible) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      geocode(q, ctrl.signal)
        .then((results) => setRemote({ q, results }))
        .catch((e: unknown) => {
          if ((e as Error).name !== 'AbortError') setRemote({ q, results: [], error: 'No se pudo buscar la dirección. Intenta de nuevo.' })
        })
    }, NOMINATIM_DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, eligible])
  const fresh = eligible && remote.q === q
  const remoteResults = fresh ? remote.results : NO_RESULTS
  const loading = eligible && remote.q !== q
  const error = geoError ?? (fresh ? remote.error : undefined)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const results = useMemo(() => [...local, ...remoteResults.filter((r) => !local.some((l) => l.label === r.label))], [local, remoteResults])

  function choose(r: SearchResult) {
    onSelect(r.kind === 'direccion' ? (SAMPLE_ADDRESSES.find((a) => a.id === r.id) ?? toAddress(r)) : toAddress(r))
    setQuery('')
    setOpen(false)
  }

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setGeoError('Tu navegador no permite obtener la ubicación.')
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        if (!inCdmx(coords.latitude, coords.longitude)) {
          setGeoError('Tu ubicación está fuera de la Ciudad de México.')
          return
        }
        choose({ id: `geo:${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`, kind: 'ubicacion', label: 'Mi ubicación', lat: coords.latitude, lon: coords.longitude })
      },
      () => {
        setLocating(false)
        setGeoError('No pudimos obtener tu ubicación. Revisa los permisos del navegador.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showOsm = remoteResults.length > 0 || loading

  return (
    <div ref={rootRef} className={`relative w-full max-w-md ${className ?? ''}`}>
      <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white py-1 pr-1 pl-4 shadow-sm focus-within:border-ink">
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Buscar dirección, colonia o código postal"
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-gray-400"
          placeholder={value.label || 'Calle y número, colonia o CP'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setGeoError(null)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {locating ? 'Ubicando…' : 'Usar mi ubicación'}
        </button>
      </div>
      {error && <p role="alert" className="mt-1 px-4 text-xs text-atencion">{error}</p>}
      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
          <ul id={listId} role="listbox" className="max-h-80 overflow-auto py-1">
            {results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(r)
                }}
                className={`flex cursor-pointer items-start gap-2 px-4 py-2 text-sm ${i === active ? 'bg-panel' : ''}`}
              >
                <span className="mt-0.5 shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">{KIND_LABEL[r.kind]}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.label}</span>
                  {r.detail && <span className="block truncate text-xs text-gray-500">{r.detail}</span>}
                </span>
              </li>
            ))}
            {!results.length && !loading && <li className="px-4 py-3 text-sm text-gray-500">{!eligible ? 'Escribe calle y número, colonia o CP.' : 'Sin resultados en la CDMX.'}</li>}
            {loading && <li className="px-4 py-2 text-xs text-gray-500">Buscando dirección…</li>}
          </ul>
          {showOsm && (
            <p className="border-t border-black/5 px-4 py-1.5 text-[10px] text-gray-500">
              Búsqueda de direcciones: <a className="underline" href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer">Nominatim</a> · ©{' '}
              <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">colaboradores de OpenStreetMap</a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
