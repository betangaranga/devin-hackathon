import { SAMPLE_ADDRESSES } from '../data'
import type { Address } from '../types'

export interface AddressSearchProps {
  value: Address
  onSelect: (address: Address) => void
  className?: string
}

// Phase-0 stub; F3 replaces the implementation (geocoding + colonia/CP search) and keeps this interface.
export function AddressSearch({ value, onSelect, className }: AddressSearchProps) {
  return (
    <select
      className={`rounded-full border px-3 py-1 ${className ?? ''}`}
      value={value.id}
      onChange={(e) => onSelect(SAMPLE_ADDRESSES.find((a) => a.id === e.target.value)!)}
    >
      {SAMPLE_ADDRESSES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
    </select>
  )
}
