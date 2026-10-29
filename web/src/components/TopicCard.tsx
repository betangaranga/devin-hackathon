import type { TopicMeta } from "@/lib/topics";
import type { TopicValue } from "@/lib/types";
import { level } from "@/lib/score";
import { PercentileBar } from "@/components/PercentileBar";

const TEXT = { green: "text-green", orange: "text-orange", red: "text-red" } as const;

export function TopicCard({
  topic,
  value,
  selected,
  onSelect,
}: {
  topic: TopicMeta;
  value: TopicValue | undefined;
  selected?: boolean;
  onSelect?: (key: string) => void;
}) {
  const score = value?.score_0_100 ?? 0;
  const lv = level(score);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(topic.key)}
      className={`w-full rounded-2xl border bg-card p-4 text-left transition-colors ${
        selected ? "border-foreground" : "border-border hover:border-tertiary"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{topic.name}</h3>
        <span className={`text-xs font-semibold ${TEXT[lv.color]}`}>{lv.label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value?.metric_label ?? "—"}</p>
      <p className="mt-0.5 text-xs text-secondary">{topic.unit}</p>
      <div className="mt-3">
        <PercentileBar score={score} />
      </div>
      {topic.ask.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {topic.ask.map((q) => (
            <li key={q} className="text-xs text-secondary">
              {q}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}
