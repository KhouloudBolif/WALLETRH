"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Lock } from "lucide-react";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { StatChip, StatRow } from "@/components/layout/stat-chip";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { allCategories, categoryFilterLabels, type DocumentCategory } from "@/lib/document-category";
import type { DocumentResult, EmployeeSummary } from "@/lib/search/documents";
import { cn } from "@/lib/utils";

type EmployeeDossierProps = {
  employee: EmployeeSummary;
  documents: DocumentResult[];
};

/** Groups the raw Base-sheet metadata blob into scannable themes instead of one
 * flat alphabetical dump. Any key that doesn't match a known theme still shows
 * up under "Autres" — nothing from the source data is ever silently dropped. */
const METADATA_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "Identité",
    keys: ["Genre", "CIN", "Date de Naissance", "Adresse", "Contact", "E-Mail"],
  },
  {
    title: "Poste & organisation",
    keys: [
      "Poste",
      "Service",
      "Direction",
      "Entité",
      "Sous-Entité",
      "Zone",
      "Agence",
      "Adm./Tech.",
      "Position",
      "Collège",
    ],
  },
  {
    title: "Hiérarchie",
    keys: [
      "Matricule Responsable Hirérachique",
      "Prénom Responsable Hirérachique",
      "Nom Responsable Hirérachique",
      "Nbr Personnes Gérées Directement",
      "Nbr Personnes Gérées Indirectement",
      "Encadrant",
    ],
  },
  {
    title: "Carrière",
    keys: [
      "Statut",
      "Situation",
      "Catégorie",
      "Date Catégorie",
      "Niveau",
      "Date Niveau",
      "Degré",
      "Grade",
      "Date Grade",
      "Date d'Entrée",
      "Date d'Ancienneté",
      "Date Départ",
      "Diplôme",
    ],
  },
];

/** Already shown in the identity header — don't repeat in the metadata grid. */
const HEADER_FIELDS = new Set(["Matricule", "Prénom", "Nom"]);

function groupMetadata(metadata: Record<string, string> | null) {
  if (!metadata) return [];
  const entries = Object.entries(metadata).filter(([key]) => !HEADER_FIELDS.has(key));
  const used = new Set<string>();
  const groups = METADATA_GROUPS.map(({ title, keys }) => {
    const rows = keys
      .map((key) => {
        const match = entries.find(([k]) => k.toLowerCase() === key.toLowerCase());
        if (!match) return null;
        used.add(match[0]);
        return match;
      })
      .filter((r): r is [string, string] => r !== null);
    return { title, rows };
  }).filter((g) => g.rows.length > 0);

  const rest = entries.filter(([key]) => !used.has(key));
  if (rest.length > 0) groups.push({ title: "Autres", rows: rest });

  return groups;
}

/** Best-effort lookup in the raw Base-sheet metadata blob (not a typed column, e.g. phone number). */
function metadataValue(metadata: Record<string, string> | null, ...keys: string[]) {
  if (!metadata) return undefined;
  for (const key of keys) {
    if (metadata[key]) return metadata[key];
  }
  return undefined;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

/** Metadata values arrive as raw strings — most are plain text, but dates come
 * through as ISO timestamps (from the Apps Script / Sheets path) and need
 * formatting rather than being shown verbatim. */
function formatMetadataValue(value: string) {
  if (!ISO_DATE_RE.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Fact({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate text-sm font-medium" title={value}>
        {href ? (
          <Link href={href} className="hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function EmployeeDossier({ employee, documents }: EmployeeDossierProps) {
  const authorizedCount = documents.filter((d) => d.authorized).length;
  const subtitle = [employee.poste, employee.service].filter(Boolean).join(" · ");
  const metadataGroups = groupMetadata(employee.metadata);

  const facts: { label: string; value: string; href?: string }[] = [
    employee.cin && { label: "CIN", value: employee.cin },
    (() => {
      const contact = metadataValue(employee.metadata, "CONTACT", "Contact");
      return contact ? { label: "Contact", value: contact } : null;
    })(),
    employee.zone && { label: "Zone", value: employee.zone },
    employee.agence && { label: "Agence", value: employee.agence },
    employee.managerMatricule &&
      employee.managerMatricule !== employee.matricule && {
        label: "Responsable",
        value: employee.managerMatricule,
        href: `/dashboard/employees/${encodeURIComponent(employee.managerMatricule)}`,
      },
    employee.position && { label: "Position", value: employee.position },
    employee.categorieRh && { label: "Catégorie RH", value: employee.categorieRh },
    employee.dateEntree && { label: "Date d'entrée", value: formatDate(employee.dateEntree) },
  ].filter((f): f is { label: string; value: string; href?: string } => Boolean(f));

  const documentsByCategory = allCategories
    .map((category) => ({
      category,
      docs: documents.filter((d) => d.category === category),
    }))
    .filter((group) => group.docs.length > 0);

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/employees"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 inline-flex h-7 items-center gap-1 text-xs text-muted-foreground",
        )}
      >
        <ArrowLeft className="size-3.5" />
        Annuaire
      </Link>

      {/* Identity card — a banner + overlapping avatar, like an ID/profile card. */}
      <Panel padding="none" elevated className="enter-fade overflow-hidden">
        <div className="relative h-16 overflow-hidden sm:h-20" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, var(--rail) 0%, color-mix(in oklch, var(--brand-accent) 62%, var(--rail)) 78%)",
            }}
          />
          <div className="brand-grid absolute inset-0 opacity-20" />
          <div
            className="absolute -top-10 -right-6 size-32 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--brand-accent)" }}
          />
          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-card" />
        </div>
        <div className="-mt-10 px-4 pb-4 sm:-mt-12 sm:px-6 sm:pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-3.5">
              <EmployeeAvatar
                name={employee.displayName}
                size="xl"
                className="ring-4 ring-card"
              />
              <div className="min-w-0 pb-1">
                <h1 className="font-serif text-2xl font-medium tracking-tight text-balance sm:text-[1.75rem]">
                  {employee.displayName}
                </h1>
                {employee.archivedAt && (
                  <Badge variant="outline" className="mt-1">
                    Archivé — absent de la feuille Base
                  </Badge>
                )}
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {employee.matricule}
                </p>
              </div>
            </div>
          </div>

          {subtitle && <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>}
          {employee.direction && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">{employee.direction}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {employee.statut && <Badge variant="outline">{employee.statut}</Badge>}
              {employee.situation && <Badge variant="outline">{employee.situation}</Badge>}
              {employee.genre && (
                <Badge variant="outline">{employee.genre === "H" ? "Homme" : "Femme"}</Badge>
              )}
              {employee.encadrant && <Badge variant="outline">Encadrant</Badge>}
            </div>
            <StatRow>
              {employee.age !== null && <StatChip label="Âge" value={employee.age} />}
              {employee.anciennete !== null && (
                <StatChip label="Ancienneté" value={`${employee.anciennete} ans`} />
              )}
              <StatChip label="Enfants" value={employee.childrenCount} />
            </StatRow>
          </div>

          {facts.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border/70 pt-4 sm:grid-cols-4">
              {facts.map((fact) => (
                <Fact key={fact.label} label={fact.label} value={fact.value} href={fact.href} />
              ))}
            </dl>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-start">
        {/* Left: full État personnel detail, sticky on desktop. */}
        {metadataGroups.length > 0 && (
          <div className="space-y-4 lg:sticky lg:top-20 enter-fade" style={{ animationDelay: "60ms" }}>
            <Panel>
              <PanelHeader
                title="État personnel"
                description="Données de la feuille Base (synchronisées)"
              />
              <div className="space-y-4">
                {metadataGroups.map((group) => (
                  <div key={group.title}>
                    <p className="mb-1.5 text-[10px] font-medium tracking-[0.1em] text-muted-foreground/70 uppercase">
                      {group.title}
                    </p>
                    <dl className="space-y-1.5">
                      {group.rows.map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-3">
                          <dt className="truncate text-xs text-muted-foreground">{label}</dt>
                          <dd className="shrink-0 truncate text-xs font-medium" title={value}>
                            {formatMetadataValue(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {/* Right: documents grouped by folder/category. */}
        <div
          className={cn(
            "space-y-3 enter-fade",
            metadataGroups.length === 0 && "lg:col-span-2",
          )}
          style={{ animationDelay: "100ms" }}
        >
          <PanelHeader
            title="Documents"
            description={`${documents.length} indexé${documents.length !== 1 ? "s" : ""} · ${authorizedCount} accessible${authorizedCount !== 1 ? "s" : ""} — lien uniquement si vos droits l'autorisent`}
          />

          {documentsByCategory.length === 0 ? (
            <Panel>
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun document indexé pour ce matricule.
              </p>
            </Panel>
          ) : (
            documentsByCategory.map(({ category, docs }) => (
              <DocumentCategoryGroup key={category} category={category} docs={docs} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentCategoryGroup({
  category,
  docs,
}: {
  category: DocumentCategory;
  docs: DocumentResult[];
}) {
  const authorizedCount = docs.filter((d) => d.authorized).length;
  const anyAuthorized = authorizedCount > 0;

  return (
    <Panel padding="none">
      <Collapsible defaultOpen={anyAuthorized}>
        <CollapsibleTrigger className="px-3 py-2.5 sm:px-4">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{categoryFilterLabels[category]}</span>
            <Badge variant={anyAuthorized ? "secondary" : "outline"} className="text-[10px]">
              {authorizedCount}/{docs.length}
            </Badge>
          </span>
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <div className="grid gap-2 border-t border-border/70 p-3 sm:grid-cols-2 sm:px-4">
            {docs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </Panel>
  );
}

function DocumentCard({ doc }: { doc: DocumentResult }) {
  const content = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          doc.authorized ? "bg-(--brand-accent-soft) text-primary" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {doc.authorized ? <FileText className="size-4" /> : <Lock className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" title={doc.fileName}>
          {doc.fileName}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {formatDate(doc.modifiedAt)}
          {doc.authorized ? (
            <ExternalLink className="size-3" />
          ) : (
            <span className="text-muted-foreground/80">· Accès refusé</span>
          )}
        </span>
      </span>
    </>
  );

  const baseClass = "flex items-center gap-2.5 rounded-lg border border-border/70 px-2.5 py-2 transition-colors";

  if (doc.authorized && doc.viewUrl) {
    return (
      <a
        href={doc.viewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(baseClass, "hover:border-border hover:bg-muted/40")}
      >
        {content}
      </a>
    );
  }

  return <div className={cn(baseClass, "opacity-60")}>{content}</div>;
}
