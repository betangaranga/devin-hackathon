import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCell } from "@/lib/data";
import { ReportView } from "@/components/ReportView";
import { DEFAULT_PROFILE } from "@/profiles";
import { SCORED_TOPICS } from "@/topics";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ h3: string }>;
}): Promise<Metadata> {
  const { h3 } = await params;
  const cell = await getCell(h3);
  if (!cell) return { title: "Antes de rentar" };
  return {
    title: `${cell.label} — Antes de rentar`,
    description: `Reporte de ${cell.colonia}: agua, inundación, sismo, seguridad vial, ruido, calor y servicios a pie.`,
    openGraph: { title: cell.label },
  };
}

export default async function ReportePage({
  params,
  searchParams,
}: {
  params: Promise<{ h3: string }>;
  searchParams: Promise<{ perfil?: string; tema?: string }>;
}) {
  const { h3 } = await params;
  const { perfil, tema } = await searchParams;
  const cell = await getCell(h3);
  if (!cell) notFound();
  return (
    <ReportView
      cell={cell}
      initialProfile={perfil ?? DEFAULT_PROFILE}
      initialTopic={tema && SCORED_TOPICS.some((t) => t.key === tema) ? tema : undefined}
    />
  );
}
