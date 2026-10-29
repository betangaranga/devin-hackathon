import type { Address, Cell, TopicKey } from '../types'

export interface CityMapProps {
  address: Address
  cell: Cell | null
  topic: TopicKey
  className?: string
}

// Phase-0 stub; F2 replaces the implementation and keeps this interface.
export function CityMap({ address, topic, className }: CityMapProps) {
  return (
    <div className={`flex items-center justify-center rounded-3xl bg-gray-200 text-sm text-gray-500 ${className ?? ''}`}>
      Mapa ({topic}) · {address.lat.toFixed(4)}, {address.lon.toFixed(4)}
    </div>
  )
}
