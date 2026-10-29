"use client";

import { PROFILES } from "@/profiles";

export function ProfilePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (profile: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Perfil">
      {Object.entries(PROFILES).map(([key, p]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            value === key
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-secondary hover:border-tertiary"
          }`}
        >
          {p.short}
        </button>
      ))}
    </div>
  );
}
