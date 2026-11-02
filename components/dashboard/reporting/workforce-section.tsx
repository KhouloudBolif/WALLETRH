"use client";

import { useState } from "react";
import { Baby, Heart, ShieldCheck, Users } from "lucide-react";
import { FilterSelect } from "@/components/dashboard/search-filters/filter-select";
import type { DirectionWorkforce, WorkforceDemographics } from "@/lib/reporting/stats";
import { genderColor, KpiCard, MeterList, ScoreRing, ShareDonut, StudioCard } from "./charts/studio";

const ALL_DIRECTIONS = "all";

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatAverage(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function shareOf(count: number, total: number): string {
  if (total <= 0) return "0 %";
  return `${Math.round((count / total) * 100)} %`;
}

export function WorkforceSection({
  data: overall,
  directions,
}: {
  data: WorkforceDemographics;
  directions: DirectionWorkforce[];
}) {
  const [direction, setDirection] = useState(ALL_DIRECTIONS);
  const selected = directions.find((item) => item.label === direction);
  const data = selected?.data ?? overall;
  const managerPercent = Math.round(data.managerRatio * 100);
  const scopeLabel = selected ? selected.label : "Dans votre périmètre";

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Démographie du personnel</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {selected
              ? `Répartition de la direction ${selected.label}.`
              : "Portrait de l'effectif — âge, ancienneté, répartition organisationnelle."}
          </p>
        </div>
        <div className="w-full sm:w-72">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Direction</p>
          <FilterSelect
            value={direction}
            onValueChange={setDirection}
            placeholder="Toutes les directions"
            options={[
              { value: ALL_DIRECTIONS, label: "Toutes les directions" },
              ...directions.map((item) => ({
                value: item.label,
                label: `${item.label} (${item.data.totalEmployees})`,
              })),
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Salariés indexés"
          value={String(data.totalEmployees)}
          hint={scopeLabel}
          tone="violet"
          icon={Users}
        />
        <KpiCard
          label="Âge moyen"
          value={formatAverage(data.averageAge)}
          hint={data.averageAge === null ? "Âge non renseigné" : "Années"}
          tone="rose"
          icon={Heart}
        />
        <KpiCard
          label="Ancienneté moyenne"
          value={data.averageAnciennete === null ? "—" : `${formatAverage(data.averageAnciennete)} ans`}
          hint="Depuis l'entrée"
          tone="cyan"
          icon={ShieldCheck}
        />
        <KpiCard
          label="Conjoint au dossier"
          value={formatPercent(data.spouseDocumentRatio)}
          hint={
            data.totalEmployees === 0
              ? "Aucun salarié"
              : `${Math.round(data.spouseDocumentRatio * data.totalEmployees)} dossier${Math.round(data.spouseDocumentRatio * data.totalEmployees) > 1 ? "s" : ""}`
          }
          tone="teal"
          icon={Baby}
        />
      </div>

      <div key={`portrait-${direction}`} className="grid gap-4 lg:grid-cols-5">
        <StudioCard
          className="lg:col-span-3"
          title="Répartition par genre"
          description="Survolez une ligne pour isoler la part dans l'anneau."
        >
          <ShareDonut
            emptyLabel="Salariés"
            slices={data.genderSplit.map((slice) => ({
              label: slice.label,
              value: slice.count,
              color: genderColor(slice.label),
            }))}
          />
        </StudioCard>

        <StudioCard
          className="lg:col-span-2"
          title="Encadrement"
          description="Part de l'effectif qui anime une équipe."
        >
          <ScoreRing
            ratio={data.managerRatio}
            tone="violet"
            label="Rôle d'encadrant"
            caption={
              data.totalEmployees === 0
                ? "Aucun salarié dans le périmètre."
                : `${Math.round(data.managerRatio * data.totalEmployees)} salarié${Math.round(data.managerRatio * data.totalEmployees) > 1 ? "s" : ""} sur ${data.totalEmployees} encadrent une équipe.`
            }
          />
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>Encadrent · {managerPercent}%</span>
              <span>Sans équipe · {100 - managerPercent}%</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/70">
              <div className="h-full bg-primary" style={{ width: `${managerPercent}%` }} />
              <div className="h-full bg-slate-300" style={{ width: `${100 - managerPercent}%` }} />
            </div>
          </div>
        </StudioCard>
      </div>

      <div key={`mix-${direction}`} className="grid gap-4 lg:grid-cols-3">
        <StudioCard title="Répartition par âge">
          <MeterList
            tone="cyan"
            rows={data.ageDistribution.map((row) => ({
              key: row.label,
              label: row.label,
              value: row.count,
              detail: shareOf(row.count, data.totalEmployees),
            }))}
            formatValue={(value) => String(value)}
          />
        </StudioCard>
        <StudioCard title="Répartition par ancienneté">
          <MeterList
            tone="violet"
            rows={data.seniorityDistribution.map((row) => ({
              key: row.label,
              label: row.label,
              value: row.count,
              detail: shareOf(row.count, data.totalEmployees),
            }))}
            formatValue={(value) => String(value)}
          />
        </StudioCard>
        <StudioCard
          title="Répartition par nombre d'enfants"
          description="Nombre déclaré dans la feuille Complétude des dossiers."
        >
          <MeterList
            tone="teal"
            rows={data.childrenDistribution.map((row) => ({
              key: row.label,
              label: row.label,
              value: row.count,
              detail: shareOf(row.count, data.totalEmployees),
            }))}
            formatValue={(value) => String(value)}
          />
        </StudioCard>
      </div>

      <div className={selected ? "grid gap-4" : "grid gap-4 lg:grid-cols-2"}>
        {selected ? null : (
          <StudioCard
            title="Effectif par direction"
            description="Cliquez une direction pour voir sa répartition."
          >
            {overall.headcountByDirection.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune direction.</p>
            ) : (
              <MeterList
                tone="violet"
                onRowClick={(key) => {
                  if (directions.some((item) => item.label === key)) setDirection(key);
                }}
                rows={overall.headcountByDirection.map((row) => ({
                  key: row.label,
                  label: row.label,
                  value: row.count,
                  detail: shareOf(row.count, overall.totalEmployees),
                  interactive: directions.some((item) => item.label === row.label),
                }))}
                formatValue={(value) => `${value}`}
              />
            )}
          </StudioCard>
        )}

        <StudioCard title="Effectif par service" description={`${data.headcountByService.length} services`}>
          {data.headcountByService.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun service.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1">
              <MeterList
                tone="cyan"
                rows={data.headcountByService.map((row) => ({
                  key: row.label,
                  label: row.label,
                  value: row.count,
                  detail: shareOf(row.count, data.totalEmployees),
                }))}
                formatValue={(value) => `${value}`}
              />
            </div>
          )}
        </StudioCard>
      </div>
    </section>
  );
}
