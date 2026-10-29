import { useState } from 'react'
import { Icon } from './icons'

export function AskLandlord({ questions }: { questions: string[] }) {
  const [open, setOpen] = useState(false)
  if (!questions.length) return null
  return (
    <div className="rounded-2xl bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium"
      >
        Pregunta al arrendador ({questions.length})
        <Icon name="chevron" size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="flex list-disc flex-col gap-1 px-8 pb-3 text-xs text-neutral-600">
          {questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
