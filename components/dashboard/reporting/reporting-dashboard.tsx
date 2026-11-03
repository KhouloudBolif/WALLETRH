"use client";

import type { CompletenessOverview, DirectionWorkforce, WorkforceDemographics } from "@/lib/reporting/stats";
import { CompletenessSection } from "./completeness-section";
import { WorkforceSection } from "./workforce-section";

type ReportingDashboardProps = {
  workforce: WorkforceDemographics;
  directions: DirectionWorkforce[];
  completeness: CompletenessOverview;
};

export function ReportingDashboard({ workforce, directions, completeness }: ReportingDashboardProps) {
  return (
    <div className="space-y-8">
      <header className="report-enter">
        <span className="mb-3 block h-0.5 w-8 rounded-full bg-primary" aria-hidden />
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          Rapports
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Vue d&apos;ensemble de l&apos;effectif et de la complétude des dossiers.
        </p>
      </header>

      <WorkforceSection data={workforce} directions={directions} />
      <CompletenessSection data={completeness} />
    </div>
  );
}
