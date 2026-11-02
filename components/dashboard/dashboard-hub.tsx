import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookUser,
  CheckCircle2,
  ClipboardCheck,
  CloudOff,
  FileSearch,
  Files,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { FeatureCard } from "@/components/layout/feature-card";
import { StatTile } from "@/components/layout/stat-chip";
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

const GENDER_COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)"];

/** Compact stacked bar + legend — a lighter-weight alternative to the full
 * recharts donut on the reporting page, sized for a small dashboard panel. */
function GenderSplitBar({ data }: { data: BucketCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return null;

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {data.map((d, i) => (
          <span
            key={d.label}
            style={{
              width: `${(d.count / total) * 100}%`,
              backgroundColor: GENDER_COLORS[i % GENDER_COLORS.length],
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <span key={d.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: GENDER_COLORS[i % GENDER_COLORS.length] }}
              aria-hidden
            />
            {d.label}
            <span className="font-medium tabular-nums text-foreground">
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
  const completenessTone =
    completeness.overallRate >= 0.75 ? "good" : completeness.overallRate >= 0.45 ? "watch" : "critical";

  return (
    <div className="space-y-8">
      <section className="enter-fade flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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
          className="enter-fade border-[color-mix(in_oklch,var(--status-watch)_35%,var(--border))] bg-(--status-watch-soft) py-2.5"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-(--status-watch)" />
            <p className="text-sm text-muted-foreground">
              L&apos;index documentaire est vide.{" "}
              {userRole === "ADMIN" ? (
                <>
                  Lancez une synchronisation depuis{" "}
                  <Link
                    href="/admin/sync"
                    className="font-medium text-foreground hover:underline"
                  >
                    Synchronisation
                  </Link>
                  .
                </>
              ) : (
                "Contactez un administrateur pour lancer la synchronisation."
              )}
            </p>
          </div>
        </Panel>
      )}

      <section
        className="enter-fade relative grid grid-cols-2 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-elevation-sm before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-primary before:via-gold before:to-transparent sm:grid-cols-4"
        style={{ animationDelay: "60ms" }}
      >
        <KpiCell index={0} icon={Users} label="Salariés" value={stats.totalEmployees} />
        <KpiCell index={1} icon={Files} label="Documents indexés" value={stats.totalDocuments} />
        <KpiCell
          index={2}
          icon={ShieldCheck}
          label="Taux de complétude"
          value={formatPercent(completeness.overallRate)}
          tone={completenessTone}
        />
        <KpiCell
          index={3}
          icon={AlertTriangle}
          label="Dossiers incomplets"
          value={completeness.employeesWithGaps}
          tone={completeness.employeesWithGaps > 0 ? "critical" : "good"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Effectif — quick demographic read, links to the full report. */}
        <Panel padding="md" className="enter-fade" style={{ animationDelay: "90ms" }}>
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
            <StatTile
              label="Âge moyen"
              value={workforce.averageAge === null ? "—" : workforce.averageAge.toFixed(1)}
            />
            <StatTile
              label="Ancienneté moy."
              value={
                workforce.averageAnciennete === null
                  ? "—"
                  : `${workforce.averageAnciennete.toFixed(1)} ans`
              }
            />
            <StatTile label="Encadrants" value={formatPercent(workforce.managerRatio)} />
            <StatTile
              label="Directions"
              value={workforce.headcountByDirection.length}
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
              <ul className="space-y-2">
                {workforce.headcountByDirection.slice(0, 3).map((d) => {
                  const max = workforce.headcountByDirection[0]?.count ?? 1;
                  return (
                    <li key={d.label} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                        {d.label}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-(--chart-1)"
                          style={{ width: `${Math.max((d.count / max) * 100, 6)}%` }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums">
                        {d.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>

        {/* À surveiller — the actionable list: who to chase for missing documents. */}
        <Panel padding="md" className="enter-fade" style={{ animationDelay: "90ms" }}>
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
              {topGaps.map((gap) => (
                <li key={gap.matricule}>
                  <Link
                    href={`/dashboard/employees/${encodeURIComponent(gap.matricule)}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/70"
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-primary"
                      aria-hidden
                    >
                      {initials(gap.displayName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{gap.displayName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {gap.service ?? "—"}
                      </span>
                    </span>
                    <Badge variant="destructive" className="shrink-0 text-[10px]">
                      {gap.missingCount} manquant{gap.missingCount > 1 ? "s" : ""}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section className="enter-fade space-y-3" style={{ animationDelay: "120ms" }}>
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
        <section className="enter-fade space-y-3" style={{ animationDelay: "150ms" }}>
          <div>
            <h2 className="font-serif text-xl font-medium tracking-tight">Administration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Comptes portail, droits d&apos;accès et index Drive
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FeatureCard
              href="/admin"
              icon={LayoutDashboard}
              title="Vue d'ensemble"
              description="Statistiques et dernière synchronisation."
            />
            <FeatureCard
              href="/admin/sync"
              icon={CloudOff}
              title="Synchronisation"
              description="Historique des synchronisations Drive."
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

      <section className="enter-fade" style={{ animationDelay: "180ms" }}>
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

function KpiCell({
  index,
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  index: number;
  icon: typeof Users;
  label: string;
  value: string | number;
  tone?: "default" | "good" | "watch" | "critical";
}) {
  const toneClass = {
    default: "text-foreground",
    good: "text-(--status-good)",
    watch: "text-(--status-watch)",
    critical: "text-(--status-critical)",
  }[tone];

  return (
    <div
      className={cn(
        "px-5 py-5",
        index % 2 === 1 && "border-l border-border/70",
        index >= 2 && "border-t border-border/70",
        index > 0 && "sm:border-t-0 sm:border-l sm:border-border/70",
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-accent text-primary">
        <Icon className="size-4" />
      </span>
      <p className={cn("mt-4 font-serif text-3xl leading-none font-medium tracking-tight tabular-nums", toneClass)}>
        {value}
      </p>
      <p className="mt-2 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
    </div>
  );
}
