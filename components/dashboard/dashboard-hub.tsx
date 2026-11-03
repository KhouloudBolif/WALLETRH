import Link from "next/link";
import type { CSSProperties } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookUser,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Files,
  Heart,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { FeatureCard } from "@/components/layout/feature-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getResolvedAccessForUser, unauthenticatedAccess } from "@/lib/permissions/access-rules";
import { getCompletenessOverview, getWorkforceDemographics, type BucketCount } from "@/lib/reporting/stats";
import { getIndexStats } from "@/lib/search/documents";
import { cn, initials } from "@/lib/utils";

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrateur",
  RH_MANAGER: "Responsable RH",
  RH_AGENT: "Agent RH",
};

const roleHints: Record<Role, string> = {
  ADMIN:
    "Gérez les comptes, les droits par dossier et l'index documentaire. La recherche fonctionne comme pour un agent RH.",
  RH_MANAGER:
    "Accès à tous les dossiers salariés — recherche par CIN, nom, diplôme, zone, etc.",
  RH_AGENT:
    "Droits limités aux dossiers autorisés (ex. Recrutement, État civil). Les documents refusés s'affichent sans lien.",
};

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

const GENDER_COLORS = ["#0891b2", "#7c3aed", "#94a3b8"];
const DIRECTION_BARS = [
  "linear-gradient(90deg, #7c3aed 0%, #a78bfa 55%, #c4b5fd 100%)",
  "linear-gradient(90deg, #0891b2 0%, #38bdf8 55%, #f0b429 100%)",
  "linear-gradient(90deg, #0f766e 0%, #14b8a6 55%, #5eead4 100%)",
];

function GenderSplitBar({ data }: { data: BucketCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return null;

  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-full border border-black/5 bg-muted/70">
        {data.map((d, i) => {
          const pct = (d.count / total) * 100;
          return (
            <span
              key={d.label}
              className="coverage-bar-fill h-full first:rounded-l-full last:rounded-r-full"
              style={
                {
                  "--coverage-target": `${pct}%`,
                  animationDelay: `${i * 80}ms, ${i * 80}ms`,
                  backgroundImage: [
                    "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.4) 50%, transparent 75%)",
                    `linear-gradient(90deg, ${GENDER_COLORS[i % GENDER_COLORS.length]}, ${GENDER_COLORS[i % GENDER_COLORS.length]})`,
                  ].join(", "),
                } as CSSProperties
              }
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <span
            key={d.label}
            className="report-enter flex items-center gap-1.5 text-xs text-muted-foreground"
            style={{ animationDelay: `${120 + i * 60}ms` }}
          >
            <span
              className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: GENDER_COLORS[i % GENDER_COLORS.length] }}
              aria-hidden
            />
            {d.label}
            <span className="font-semibold tabular-nums text-foreground">
              {Math.round((d.count / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

type DashboardHubProps = {
  userId: string | null;
  userName: string;
  userRole: Role;
};

export async function DashboardHub({ userId, userName, userRole }: DashboardHubProps) {
  const viewerAccess = userId
    ? await getResolvedAccessForUser(userId, userRole)
    : unauthenticatedAccess(userRole);

  const [stats, completeness, workforce] = await Promise.all([
    getIndexStats(),
    getCompletenessOverview(viewerAccess),
    getWorkforceDemographics(viewerAccess),
  ]);

  const indexEmpty = stats.totalDocuments === 0;
  const firstName = userName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const topGaps = completeness.topGaps.slice(0, 5);
  const todayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const completenessPct = Math.round(completeness.overallRate * 100);
  const completenessTone =
    completeness.overallRate >= 0.75 ? "teal" : completeness.overallRate >= 0.45 ? "amber" : "rose";

  return (
    <div className="space-y-8">
      <section className="report-enter flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-primary uppercase">
            {roleLabels[userRole]}
            <span className="mx-2 text-border">/</span>
            <span className="font-medium tracking-[0.08em] text-muted-foreground capitalize">
              {todayLabel}
            </span>
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl">
            {greeting},
            <span className="mt-1 block font-medium text-primary italic">{firstName}</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {roleHints[userRole]}
          </p>
        </div>

        <Link
          href="/dashboard/search"
          className={cn(
            buttonVariants({ size: "default" }),
            "h-12 w-full shrink-0 gap-2 rounded-full px-6 sm:w-auto",
          )}
        >
          <FileSearch className="size-4" />
          Rechercher un dossier
          <ArrowRight className="size-4" />
        </Link>
      </section>

      {indexEmpty && (
        <Panel
          className="report-enter border-[color-mix(in_oklch,var(--status-watch)_35%,var(--border))] bg-(--status-watch-soft) py-2.5"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-(--status-watch)" />
            <p className="text-sm text-muted-foreground">
              L&apos;index documentaire est vide.{" "}
              <>
                Lancez une synchronisation depuis{" "}
                <Link
                  href="/dashboard/synchronisation"
                  className="font-medium text-foreground hover:underline"
                >
                  Synchronisation
                </Link>
                .
              </>
            </p>
          </div>
        </Panel>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <HubKpi
          label="Salariés"
          value={String(stats.totalEmployees)}
          hint="Dossiers indexés"
          tone="violet"
          icon={Users}
          delayMs={40}
        />
        <HubKpi
          label="Documents indexés"
          value={String(stats.totalDocuments)}
          hint="Fichiers Drive"
          tone="cyan"
          icon={Files}
          delayMs={90}
        />
        <HubKpi
          label="Taux de complétude"
          value={formatPercent(completeness.overallRate)}
          hint="Pièces obligatoires"
          tone={completenessTone}
          icon={ShieldCheck}
          delayMs={140}
          progress={completenessPct}
        />
        <HubKpi
          label="Dossiers incomplets"
          value={String(completeness.employeesWithGaps)}
          hint="À relancer"
          tone={completeness.employeesWithGaps > 0 ? "rose" : "teal"}
          icon={AlertTriangle}
          delayMs={190}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          padding="md"
          className="report-enter"
          style={{ animationDelay: "240ms" }}
        >
          <PanelHeader
            title="Aperçu de l'effectif"
            description="Âge, ancienneté, encadrement"
            action={
              <Link
                href="/dashboard/reporting"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Rapport complet
                <ArrowRight className="size-3" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <HubMiniStat
              label="Âge moyen"
              value={workforce.averageAge === null ? "—" : workforce.averageAge.toFixed(1)}
              tone="rose"
              icon={Heart}
            />
            <HubMiniStat
              label="Ancienneté moy."
              value={
                workforce.averageAnciennete === null
                  ? "—"
                  : `${workforce.averageAnciennete.toFixed(1)} ans`
              }
              tone="cyan"
              icon={Shield}
            />
            <HubMiniStat
              label="Encadrants"
              value={formatPercent(workforce.managerRatio)}
              tone="violet"
              icon={Users}
              progress={Math.round(workforce.managerRatio * 100)}
            />
            <HubMiniStat
              label="Directions"
              value={workforce.headcountByDirection.length}
              tone="teal"
              icon={BarChart3}
            />
          </div>

          {workforce.genderSplit.length > 0 && (
            <div className="mt-4 border-t border-border/70 pt-4">
              <p className="mb-2 text-[10px] font-medium tracking-[0.1em] text-muted-foreground/70 uppercase">
                Répartition par genre
              </p>
              <GenderSplitBar data={workforce.genderSplit} />
            </div>
          )}

          {workforce.headcountByDirection.length > 0 && (
            <div className="mt-4 border-t border-border/70 pt-4">
              <p className="mb-2 text-[10px] font-medium tracking-[0.1em] text-muted-foreground/70 uppercase">
                Principales directions
              </p>
              <ul className="space-y-2.5">
                {workforce.headcountByDirection.slice(0, 3).map((d, i) => {
                  const max = workforce.headcountByDirection[0]?.count ?? 1;
                  const pct = Math.max((d.count / max) * 100, 6);
                  return (
                    <li
                      key={d.label}
                      className="report-enter flex items-center gap-3"
                      style={{ animationDelay: `${300 + i * 70}ms` }}
                    >
                      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                        {d.label}
                      </span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full border border-black/5 bg-muted/70">
                        <span
                          className="coverage-bar-fill block h-full rounded-full"
                          style={
                            {
                              "--coverage-target": `${pct}%`,
                              animationDelay: `${320 + i * 70}ms, ${320 + i * 70}ms`,
                              backgroundImage: [
                                "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.4) 50%, transparent 75%)",
                                DIRECTION_BARS[i % DIRECTION_BARS.length],
                              ].join(", "),
                            } as CSSProperties
                          }
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums">
                        {d.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>

        <Panel
          padding="md"
          className="report-enter"
          style={{ animationDelay: "280ms" }}
        >
          <PanelHeader
            title="À surveiller"
            description="Dossiers les plus incomplets"
            action={
              <Link
                href="/dashboard/completeness"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Voir tout
                <ArrowRight className="size-3" />
              </Link>
            }
          />
          {topGaps.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-(--status-good)" />
              Aucun dossier incomplet parmi les catégories qui vous sont accessibles.
            </div>
          ) : (
            <ul className="space-y-1">
              {topGaps.map((gap, index) => {
                const max = topGaps[0]?.missingCount || 1;
                const pct = (gap.missingCount / max) * 100;
                return (
                  <li
                    key={gap.matricule}
                    className="report-enter"
                    style={{ animationDelay: `${320 + index * 55}ms` }}
                  >
                    <Link
                      href={`/dashboard/employees/${encodeURIComponent(gap.matricule)}`}
                      className="group block rounded-xl px-2 py-2 transition-colors hover:bg-muted/70"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-orange-100 text-[11px] font-semibold text-rose-700"
                          aria-hidden
                        >
                          {initials(gap.displayName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium group-hover:underline">
                            {gap.displayName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {gap.service ?? "—"}
                          </span>
                        </span>
                        <Badge variant="destructive" className="shrink-0 text-[10px]">
                          {gap.missingCount} manquant{gap.missingCount > 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="mt-2 ml-12 h-2 overflow-hidden rounded-full border border-black/5 bg-rose-100">
                        <div
                          className="coverage-bar-fill h-full rounded-full"
                          style={
                            {
                              "--coverage-target": `${pct}%`,
                              animationDelay: `${360 + index * 55}ms, ${360 + index * 55}ms`,
                              backgroundImage: [
                                "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.4) 50%, transparent 75%)",
                                "linear-gradient(90deg, #f43f5e 0%, #e11d48 45%, #a855f7 100%)",
                              ].join(", "),
                            } as CSSProperties
                          }
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <section className="report-enter space-y-3" style={{ animationDelay: "360ms" }}>
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight">Explorer</h2>
          <p className="mt-1 text-sm text-muted-foreground">Documents, dossiers et rapports</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FeatureCard
            href="/dashboard/search"
            icon={FileSearch}
            title="Recherche documentaire"
            description="CIN, matricule, nom, diplôme, zone — filtres catégorie, genre, âge, enfants."
            featured
          />
          <FeatureCard
            href="/dashboard/employees"
            icon={BookUser}
            title="Annuaire salariés"
            description="État personnel et PDF par sous-dossier Drive."
          />
          <FeatureCard
            href="/dashboard/completeness"
            icon={ClipboardCheck}
            title="Complétude des dossiers"
            description="Documents attendus manquants par salarié, par catégorie."
          />
          <FeatureCard
            href="/dashboard/reporting"
            icon={BarChart3}
            title="Rapports"
            description="Démographie de l'effectif et vue d'ensemble de la complétude."
          />
        </div>
      </section>

      {userRole === "ADMIN" && (
        <section className="report-enter space-y-3" style={{ animationDelay: "420ms" }}>
          <div>
            <h2 className="font-serif text-xl font-medium tracking-tight">Administration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Comptes portail, droits d&apos;accès et index Drive
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <FeatureCard
              href="/admin"
              icon={LayoutDashboard}
              title="Vue d'ensemble"
              description="Statistiques et dernière synchronisation."
            />
            <FeatureCard
              href="/admin/permissions"
              icon={Shield}
              title="Permissions"
              description="Droits par sous-dossier Drive."
            />
            <FeatureCard
              href="/admin/users"
              icon={Users}
              title="Utilisateurs"
              description="Comptes portail et test SMTP."
            />
          </div>
        </section>
      )}

      <section className="report-enter" style={{ animationDelay: "480ms" }}>
        <div className="grid gap-3 sm:max-w-xs">
          <FeatureCard
            href="/settings"
            icon={Settings}
            title="Mon compte"
            description="Nom, e-mail et mot de passe de connexion."
          />
        </div>
      </section>
    </div>
  );
}

type HubTone = "violet" | "cyan" | "teal" | "rose" | "amber";

const HUB_TONE: Record<
  HubTone,
  { edge: string; text: string; chip: string; bar: string; track: string }
> = {
  violet: {
    edge: "from-primary to-primary/40",
    text: "text-primary",
    chip: "bg-accent text-primary",
    bar: "linear-gradient(90deg, #7c3aed 0%, #a78bfa 55%, #c4b5fd 100%)",
    track: "bg-violet-100",
  },
  cyan: {
    edge: "from-sky-500 to-cyan-300",
    text: "text-sky-700",
    chip: "bg-sky-100 text-sky-700",
    bar: "linear-gradient(90deg, #0891b2 0%, #38bdf8 55%, #f0b429 100%)",
    track: "bg-sky-100",
  },
  teal: {
    edge: "from-teal-600 to-teal-300",
    text: "text-teal-700",
    chip: "bg-teal-100 text-teal-700",
    bar: "linear-gradient(90deg, #10b981 0%, #34d399 55%, #a3e635 100%)",
    track: "bg-emerald-100",
  },
  rose: {
    edge: "from-rose-500 to-orange-300",
    text: "text-rose-700",
    chip: "bg-rose-100 text-rose-700",
    bar: "linear-gradient(90deg, #f43f5e 0%, #e11d48 45%, #a855f7 100%)",
    track: "bg-rose-100",
  },
  amber: {
    edge: "from-amber-500 to-orange-300",
    text: "text-amber-800",
    chip: "bg-amber-100 text-amber-800",
    bar: "linear-gradient(90deg, #fbbf24 0%, #f97316 55%, #ef4444 100%)",
    track: "bg-amber-100",
  },
};

function HubKpi({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  delayMs = 0,
  progress,
}: {
  label: string;
  value: string;
  hint: string;
  tone: HubTone;
  icon: typeof Users;
  delayMs?: number;
  progress?: number;
}) {
  const t = HUB_TONE[tone];
  return (
    <div
      className="report-enter relative overflow-hidden rounded-2xl border border-border/80 bg-card px-4 py-3.5 shadow-elevation-xs"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", t.edge)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", t.text)}>{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className={cn("grid size-8 place-items-center rounded-xl", t.chip)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      {typeof progress === "number" ? (
        <div className={cn("mt-3 ml-2 h-2 overflow-hidden rounded-full border border-black/5", t.track)}>
          <div
            className="coverage-bar-fill h-full rounded-full"
            style={
              {
                "--coverage-target": `${Math.min(Math.max(progress, 0), 100)}%`,
                animationDelay: `${delayMs + 80}ms, ${delayMs + 80}ms`,
                backgroundImage: [
                  "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.45) 50%, transparent 75%)",
                  t.bar,
                ].join(", "),
              } as CSSProperties
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function HubMiniStat({
  label,
  value,
  tone,
  icon: Icon,
  progress,
}: {
  label: string;
  value: string | number;
  tone: HubTone;
  icon: typeof Users;
  progress?: number;
}) {
  const t = HUB_TONE[tone];
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-white to-muted/40 px-3 py-3">
      <span className={cn("mb-2 grid size-7 place-items-center rounded-lg", t.chip)}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <p className={cn("text-xl font-semibold tabular-nums leading-none", t.text)}>{value}</p>
      <p className="mt-1.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      {typeof progress === "number" ? (
        <div className={cn("mt-2 h-1.5 overflow-hidden rounded-full", t.track)}>
          <div
            className="coverage-bar-fill h-full rounded-full"
            style={
              {
                "--coverage-target": `${Math.min(Math.max(progress, 0), 100)}%`,
                backgroundImage: [
                  "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.4) 50%, transparent 75%)",
                  t.bar,
                ].join(", "),
              } as CSSProperties
            }
          />
        </div>
      ) : null}
    </div>
  );
}
