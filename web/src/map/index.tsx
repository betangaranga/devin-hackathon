import 'maplibre-gl/dist/maplibre-gl.css'
import { addProtocol, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { PMTiles, Protocol } from 'pmtiles'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCellsAround, USE_FIXTURES } from '../data'
import { TOPIC_BY_KEY } from '../topics'
import type { Address, Cell, TopicKey } from '../types'
import { iconSvg, KIND_LABEL } from './icons'
import {
  calloutStats,
  circlePolygon,
  hexCollection,
  isCellTopic,
  pmtilesUrl,
  pointCollection,
  RADIUS_M,
  synthHexScores,
  HEX_RING,
  synthPatrimonioOutline,
  topicPoints,
  type FeatureCollection,
} from './layers'

export interface CityMapProps {
  address: Address
  cell: Cell | null
  topic: TopicKey
  className?: string
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const FIT_PADDING = { top: 120, bottom: 36, left: 36, right: 36 }

// maplibre resolves its worker relative to import.meta.url, which breaks under Vite's dep pre-bundling.
setWorkerUrl(workerUrl)

let protocol: Protocol | null = null
const pmtilesAvailable = new Map<string, Promise<boolean>>()

/** Resolves true when `<key>.pmtiles` exists and is a valid archive (registers the pmtiles:// protocol once). */
function hasPmtiles(key: TopicKey): Promise<boolean> {
  if (USE_FIXTURES) return Promise.resolve(false)
  const url = pmtilesUrl(import.meta.env.BASE_URL, key, window.location.origin)
  if (!pmtilesAvailable.has(url)) {
    if (!protocol) {
      protocol = new Protocol()
      addProtocol('pmtiles', protocol.tile)
    }
    const archive = new PMTiles(url)
    pmtilesAvailable.set(
      url,
      archive.getHeader().then(
        () => {
          protocol!.add(archive)
          return true
        },
        () => false,
      ),
    )
  }
  return pmtilesAvailable.get(url)!
}

type SourceData = Parameters<GeoJSONSource['setData']>[0]

function setData(map: MapLibreMap, id: string, data: FeatureCollection) {
  ;(map.getSource(id) as GeoJSONSource | undefined)?.setData(data as SourceData)
}

function addBaseLayers(map: MapLibreMap) {
  const beforeId = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  for (const id of ['hex', 'patrimonio', 'circle', 'points']) map.addSource(id, { type: 'geojson', data: EMPTY as SourceData })

  map.addLayer({ id: 'hex-fill', type: 'fill', source: 'hex', paint: { 'fill-color': '#000', 'fill-opacity': hexOpacity() } }, beforeId)
  map.addLayer({ id: 'hex-line', type: 'line', source: 'hex', paint: { 'line-color': '#fff', 'line-width': 0.6, 'line-opacity': 0.6 } }, beforeId)
  map.addLayer({ id: 'patrimonio-fill', type: 'fill', source: 'patrimonio', paint: { 'fill-color': TOPIC_BY_KEY.patrimonio.color, 'fill-opacity': 0.08 } }, beforeId)
  map.addLayer({
    id: 'patrimonio-line',
    type: 'line',
    source: 'patrimonio',
    paint: { 'line-color': TOPIC_BY_KEY.patrimonio.color, 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [3, 2] },
  })
  map.addLayer({
    id: 'circle-line',
    type: 'line',
    source: 'circle',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#0b0b0c', 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [0, 2.5] },
  })
  map.addLayer({
    id: 'points-circle',
    type: 'circle',
    source: 'points',
    paint: {
      'circle-color': '#000',
      'circle-opacity': 0.55,
      'circle-radius': ['case', ['has', 'n'], ['+', 8, ['*', 4, ['sqrt', ['get', 'n']]]], 9],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
    },
  })
}

// Contract: opacity follows 1 - score/100 (worse cells are more opaque).
const hexOpacity = () => ['interpolate', ['linear'], ['get', 'score'], 0, 0.6, 100, 0.04] as unknown as number

function ensurePmtilesLayer(map: MapLibreMap, key: TopicKey, kind: 'fill' | 'line') {
  const src = `pm-${key}`
  if (!map.getSource(src)) {
    map.addSource(src, { type: 'vector', url: `pmtiles://${pmtilesUrl(import.meta.env.BASE_URL, key, window.location.origin)}` })
  }
  const id = `pm-${key}-${kind}`
  if (!map.getLayer(id)) {
    const color = TOPIC_BY_KEY[key].color
    if (kind === 'fill') {
      map.addLayer({ id, type: 'fill', source: src, 'source-layer': key, paint: { 'fill-color': color, 'fill-opacity': hexOpacity() } }, 'hex-fill')
    } else {
      map.addLayer({ id, type: 'line', source: src, 'source-layer': key, paint: { 'line-color': color, 'line-width': 2, 'line-dasharray': [3, 2] } }, 'patrimonio-line')
    }
  }
  return id
}

function hidePmtilesLayers(map: MapLibreMap, except?: string) {
  for (const l of map.getStyle().layers) {
    if (l.id.startsWith('pm-') && l.id !== except) map.setLayoutProperty(l.id, 'visibility', 'none')
  }
}

function circleBounds(lat: number, lon: number) {
  const ring = (circlePolygon(lat, lon, RADIUS_M, 16) as { coordinates: [number, number][][] }).coordinates[0]
  return ring.reduce((b, p) => b.extend(p), new LngLatBounds(ring[0], ring[0]))
}

export function CityMap({ address, cell, topic, className }: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const pinRef = useRef<Marker | null>(null)
  const calloutRef = useRef<Marker | null>(null)
  const serviceMarkers = useRef<Marker[]>([])
  const [calloutEl] = useState(() => {
    const el = document.createElement('div')
    el.style.zIndex = '3'
    return el
  })
  const [ready, setReady] = useState(false)
  const initialCenter = useRef<[number, number]>([address.lon, address.lat])

  useEffect(() => {
    const container = containerRef.current!
    const map = new MapLibreMap({
      container,
      style: STYLE_URL,
      center: initialCenter.current,
      zoom: 15,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.touchZoomRotate.disableRotation()
    mapRef.current = map

    const pinEl = document.createElement('div')
    pinEl.className = 'flex h-10 w-10 items-center justify-center rounded-full bg-black/15'
    pinEl.innerHTML = '<div class="flex h-4 w-4 items-center justify-center rounded-full bg-black"><div class="h-1.5 w-1.5 rounded-full bg-white"></div></div>'
    pinEl.style.zIndex = '2'
    pinRef.current = new Marker({ element: pinEl }).setLngLat(initialCenter.current).addTo(map)
    calloutRef.current = new Marker({ element: calloutEl, anchor: 'bottom', offset: [0, -22] }).setLngLat(initialCenter.current).addTo(map)

    map.on('load', () => {
      addBaseLayers(map)
      setReady(true)
    })
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(container)

    return () => {
      ro.disconnect()
      serviceMarkers.current.forEach((m) => m.remove())
      serviceMarkers.current = []
      pinRef.current?.remove()
      calloutRef.current?.remove()
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [calloutEl])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const ll: [number, number] = [address.lon, address.lat]
    pinRef.current?.setLngLat(ll)
    calloutRef.current?.setLngLat(ll)
    map.fitBounds(circleBounds(address.lat, address.lon), { padding: FIT_PADDING, maxZoom: 16, duration: ready ? 600 : 0 })
    if (ready) setData(map, 'circle', { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: circlePolygon(address.lat, address.lon), properties: {} }] })
  }, [address.lat, address.lon, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    let cancelled = false
    const meta = TOPIC_BY_KEY[topic]
    const value = cell?.topics[topic]
    const pat = cell?.topics.patrimonio

    map.setPaintProperty('hex-fill', 'fill-color', meta.color)
    const pts = topicPoints(cell, topic)
    setData(map, 'points', pointCollection(topic === 'servicios' ? [] : pts))
    map.setPaintProperty('points-circle', 'circle-color', meta.color)

    serviceMarkers.current.forEach((m) => m.remove())
    serviceMarkers.current =
      topic === 'servicios'
        ? pts.map((p) => {
            const el = document.createElement('div')
            el.className = 'flex h-7 w-7 items-center justify-center rounded-full bg-black text-white shadow ring-2 ring-white'
            el.innerHTML = iconSvg(p.kind, 15)
            el.title = `${KIND_LABEL[p.kind]}: ${p.name}${p.minutes != null ? ` · ${p.minutes} min a pie` : ''}`
            return new Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map)
          })
        : []

    const synthHex = () =>
      isCellTopic(topic) && value?.score != null ? hexCollection(synthHexScores(address.h3, value.score, topic)) : EMPTY
    const synthPat = () =>
      pat?.raw === 1 ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: synthPatrimonioOutline(address.h3), properties: {} }] } : EMPTY

    const pmKey: TopicKey | null = isCellTopic(topic) ? topic : topic === 'patrimonio' ? 'patrimonio' : null
    const apply = (usePm: boolean) => {
      if (cancelled || !mapRef.current) return
      const pmLayer = usePm && pmKey ? ensurePmtilesLayer(map, pmKey, pmKey === 'patrimonio' ? 'line' : 'fill') : undefined
      hidePmtilesLayers(map, pmLayer)
      if (pmLayer) map.setLayoutProperty(pmLayer, 'visibility', 'visible')
      if (USE_FIXTURES || !isCellTopic(topic)) setData(map, 'hex', usePm && pmKey !== 'patrimonio' ? EMPTY : synthHex())
      else if (!usePm)
        getCellsAround(address.h3, HEX_RING).then((cells) => {
          if (cancelled || !mapRef.current) return
          const scores: Record<string, number> = {}
          for (const [h, c] of Object.entries(cells)) {
            const sc = c.topics[topic]?.score
            if (sc != null) scores[h] = sc
          }
          setData(map, 'hex', hexCollection(scores))
        })
      setData(map, 'patrimonio', usePm && pmKey === 'patrimonio' ? EMPTY : (synthPat() as FeatureCollection))
      const strong = topic === 'patrimonio'
      map.setPaintProperty('patrimonio-line', 'line-opacity', strong ? 0.9 : 0.45)
      map.setPaintProperty('patrimonio-fill', 'fill-opacity', strong ? 0.14 : 0.04)
    }

    apply(false)
    if (pmKey) hasPmtiles(pmKey).then((ok) => ok && apply(true))
    return () => {
      cancelled = true
    }
  }, [ready, cell, topic, address.h3])

  const meta = TOPIC_BY_KEY[topic]
  const stats = calloutStats(cell, topic)
  const pat = cell?.topics.patrimonio
  const inZone = pat?.raw === 1
  const zoneName = typeof pat?.extra?.zone_name === 'string' ? pat.extra.zone_name : null

  return (
    <div className={`relative min-h-64 overflow-hidden rounded-3xl bg-[#f2f3f0] ${className ?? ''}`}>
      {/* maplibre sets position:relative on its container, so it fills an absolutely positioned wrapper. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" data-testid="city-map" />
      </div>
      {createPortal(
        <div className="pointer-events-none flex flex-col items-center" role="status" aria-label={`Resumen de ${meta.name}`}>
          <div className="flex items-stretch rounded-2xl bg-ink px-2 py-3 text-white shadow-lg">
            {stats.map((st, i) => (
              <div key={i} className={`flex min-w-[84px] flex-col items-center px-3 ${i > 0 ? 'border-l border-white/20' : ''}`}>
                <span className="whitespace-nowrap text-2xl font-light leading-tight">{st.v}</span>
                <span className="whitespace-nowrap text-[10px] opacity-70">{st.l}</span>
              </div>
            ))}
          </div>
          <div className="h-3 w-3 -translate-y-1.5 rotate-45 bg-ink" />
        </div>,
        calloutEl,
      )}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
          Capa: {meta.name}
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-[11px] text-gray-500 shadow-sm">
          Círculo punteado = {RADIUS_M} m · 6 min a pie{USE_FIXTURES ? ' · datos ficticios' : ''}
        </div>
      </div>
      {inZone && (
        <div
          className="pointer-events-none absolute bottom-3 left-3 flex max-w-[60%] items-center gap-1.5 truncate rounded-full bg-white px-3 py-1.5 text-[11px] shadow-sm"
          style={{ color: TOPIC_BY_KEY.patrimonio.color }}
        >
          <span className="h-2 w-2 shrink-0 rounded-sm border-2" style={{ borderColor: TOPIC_BY_KEY.patrimonio.color }} />
          <span className="truncate">Zona patrimonial{zoneName ? ` · ${zoneName}` : ''}</span>
        </div>
      )}
    </div>
  )
}
