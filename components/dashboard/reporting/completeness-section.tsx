"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Users } from "lucide-react";
import type { CompletenessOverview } from "@/lib/reporting/stats";
import { KpiCard, MeterList, ScoreRing, StudioCard } from "./charts/studio";

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function CompletenessSection({ data }: { data: CompletenessOverview }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (data.byCategory.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Complétude des dossiers</h2>
        <p className="text-sm text-muted-foreground">Aucune catégorie ne vous est accessible pour ce rapport.</p>
      </section>
    );
  }

  const rate = Math.round(data.overallRate * 100);
  const topMissing = data.byDocumentType[0];
  const busiestDirection = data.byDirection.find((row) => row.missingCount > 0);

  return (
    <section className="space-y-4">
      <div className="report-enter" style={{ animationDelay: "80ms" }}>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Complétude des dossiers</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Taux de complétude et documents manquants, agrégés sur l&apos;ensemble des salariés visibles.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <StudioCard
          className="lg:col-span-2"
          title="Score global"
          description={
            topMissing
              ? `Priorité de relance : ${topMissing.label} (${topMissing.missing} manquant${topMissing.missing > 1 ? "s" : ""}).`
              : "Aucun document obligatoire ne manque."
          }
          delayMs={120}
        >
          <ScoreRing
            ratio={data.overallRate}
            tone={rate >= 80 ? "teal" : rate >= 50 ? "cyan" : "rose"}
            label="Pièces obligatoires présentes"
            caption={
              busiestDirection
                ? `La direction la plus exposée est ${busiestDirection.direction} (${busiestDirection.missingCount} manquant${busiestDirection.missingCount > 1 ? "s" : ""}).`
                : "Toutes les directions visibles sont à jour."
            }
          />
          {data.verifiedGapCount > 0 ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {data.verifiedGapCount} manque{data.verifiedGapCount > 1 ? "s" : ""} déjà attesté
              {data.verifiedGapCount > 1 ? "s" : ""} par les RH. Ces pièces restent comptées comme absentes.
            </p>
          ) : null}
        </StudioCard>

        <div className="grid gap-3 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-1">
          <KpiCard
            label="Taux de complétude global"
            value={formatPercent(data.overallRate)}
            hint="Documents exigés et présents"
            tone={rate >= 80 ? "teal" : rate >= 50 ? "cyan" : "rose"}
            icon={CheckCircle2}
            delayMs={160}
          />
          <KpiCard
            label="Salariés avec au moins un manquant"
            value={String(data.employeesWithGaps)}
            hint={
              data.totalEmployees === 0
                ? "Aucun salarié"
                : `${Math.round((data.employeesWithGaps / data.totalEmployees) * 100)} % des dossiers suivis`
            }
            tone="rose"
            icon={AlertTriangle}
            delayMs={210}
          />
          <KpiCard
            label="Salariés couverts"
            value={String(data.totalEmployees)}
            hint="Périmètre de ce rapport"
            tone="violet"
            icon={Users}
            delayMs={260}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StudioCard
          title="Complétude par catégorie"
          description="Part des documents exigés déjà présents."
          delayMs={300}
        >
          <MeterList
            tone="status"
            scale="percent"
            rows={data.byCategory.map((row) => ({
              key: row.category,
              label: row.label,
              value: Math.round(row.rate * 100),
              detail: `${row.present}/${row.required}`,
            }))}
            formatValue={(value) => `${value} %`}
          />
        </StudioCard>

        <StudioCard
          title="Documents les plus souvent manquants"
          description="Ce qu'il est le plus utile de relancer en priorité."
          delayMs={350}
        >
          {data.byDocumentType.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun document manquant — dossiers complets.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1">
              <MeterList
                tone="rose"
                rows={data.byDocumentType.slice(0, 15).map((row) => ({
                  key: `${row.category}:${row.key}`,
                  label: row.label,
                  value: row.missing,
                  detail: row.categoryLabel,
                }))}
                formatValue={(value) => `${value}`}
              />
            </div>
          )}
        </StudioCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StudioCard title="Manquants par direction" description="Où concentrer les relances." delayMs={400}>
          {data.byDirection.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune direction.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1">
              <MeterList
                tone="rose"
                rows={data.byDirection.map((row) => ({
                  key: row.direction,
                  label: row.direction,
                  value: row.missingCount,
                  detail: `${row.employeeCount} salarié${row.employeeCount > 1 ? "s" : ""}`,
                }))}
                formatValue={(value) => `${value}`}
              />
            </div>
          )}
        </StudioCard>

        <StudioCard
          title="Dossiers les plus incomplets"
          description="Dix salariés avec le plus de documents manquants."
          delayMs={450}
        >
          {data.topGaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun dossier incomplet.</p>
          ) : (
            <ol className="space-y-2">
              {data.topGaps.map((row, index) => {
                const max = data.topGaps[0]?.missingCount || 1;
                return (
                  <li
                    key={row.matricule}
                    className="report-enter"
                    style={{ animationDelay: `${480 + index * 40}ms` }}
                  >
                    <Link
                      href={`/dashboard/employees/${encodeURIComponent(row.matricule)}`}
                      className="group block rounded-xl px-2 py-1.5 hover:bg-muted/50"
                    >
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground group-hover:underline">
                          <span className="mr-2 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                          {row.displayName}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-rose-700">
                          {row.missingCount} manquant{row.missingCount > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-black/5 bg-rose-100">
                          <div
                            className="report-meter-fill h-full rounded-full"
                            style={{
                              width: drawn ? `${(row.missingCount / max) * 100}%` : "0%",
                              transitionDelay: `${index * 55}ms`,
                              backgroundImage: [
                                "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.4) 50%, transparent 75%)",
                                "linear-gradient(90deg, #f43f5e 0%, #e11d48 45%, #a855f7 100%)",
                              ].join(", "),
                            }}
                          />
                        </div>
                        <span className="w-24 shrink-0 truncate text-right text-[11px] text-muted-foreground">
                          {row.service ?? "—"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </StudioCard>
      </div>
    </section>
  );
}
