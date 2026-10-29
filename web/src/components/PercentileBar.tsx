import { level } from "@/lib/score";

const BAR = { green: "bg-green", orange: "bg-orange", red: "bg-red" } as const;

export function PercentileBar({ score }: { score: number }) {
  const lv = level(score);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash">
        <div className={`h-full rounded-full ${BAR[lv.color]}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold tabular-nums">{score}</span>
    </div>
  );
}
