"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { CellData } from "@/lib/types";
import { TOPICS, SCORED_TOPICS, TOPIC_BY_KEY } from "@/topics";
import { profileScore, DEFAULT_PROFILE } from "@/profiles";
import { level } from "@/lib/score";
import { reportPath, whatsappShareUrl } from "@/share/url";
import { TopicCard } from "@/components/TopicCard";
import { ProfilePicker } from "@/components/ProfilePicker";

const MapView = dynamic(() => import("@/map/MapView").then((m) => m.MapView), { ssr: false });

const TEXT = { green: "text-green", orange: "text-orange", red: "text-red" } as const;

export function ReportView({
  cell,
  initialProfile = DEFAULT_PROFILE,
  initialTopic,
}: {
  cell: CellData;
  initialProfile?: string;
  initialTopic?: string;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [topicKey, setTopicKey] = useState(initialTopic ?? SCORED_TOPICS[0]?.key ?? "agua");
  const topic = TOPIC_BY_KEY.get(topicKey);

  const scores = useMemo(
    () => Object.fromEntries(Object.entries(cell.topics).map(([k, v]) => [k, v.score_0_100])),
    [cell],
  );
  const total = profileScore(scores, SCORED_TOPICS.map((t) => t.key), profile);
  const lv = level(total);

  const syncUrl = (p: string, t: string) =>
    window.history.replaceState(null, "", reportPath(cell.h3, { perfil: p, tema: t }));

  const share = () => {
    const url = whatsappShareUrl(cell.h3, cell.label, window.location.origin);
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4 py-6">
        <div>
          <Link href="/" className="text-xs text-tertiary hover:text-foreground">
            ← Antes de rentar
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{cell.label}</h1>
          <p className="text-sm text-secondary">
            {cell.colonia} · {cell.alcaldia}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold tabular-nums ${TEXT[lv.color]}`}>{total}</div>
          <div className="text-xs text-secondary">puntaje {lv.label.toLowerCase()}</div>
          <button
            type="button"
            onClick={share}
            className="mt-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:border-tertiary"
          >
            Compartir
          </button>
        </div>
      </header>

      <ProfilePicker
        value={profile}
        onChange={(p) => {
          setProfile(p);
          syncUrl(p, topicKey);
        }}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-2xl border border-border">
          <MapView center={cell.center} topic={topic} pinLabel={cell.label} />
        </div>
        <div className="grid content-start gap-3">
          {TOPICS.filter((t) => t.scored).map((t) => (
            <TopicCard
              key={t.key}
              topic={t}
              value={cell.topics[t.key]}
              selected={t.key === topicKey}
              onSelect={(k) => {
                setTopicKey(k);
                syncUrl(profile, k);
              }}
            />
          ))}
        </div>
      </div>

      {cell.patrimonio.in_zone && (
        <div className="mt-6 rounded-2xl border border-purple/40 bg-purple/5 p-4 text-sm">
          <span className="font-medium text-purple">Patrimonio: </span>
          {cell.patrimonio.label}
        </div>
      )}

      {topicKey === "servicios" && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Servicios a pie</h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {cell.services.map((s) => (
              <li key={s.kind} className="flex justify-between text-sm">
                <span className="text-secondary">{s.kind}</span>
                <span className="tabular-nums">{s.walk_min != null ? `${s.walk_min} min` : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
