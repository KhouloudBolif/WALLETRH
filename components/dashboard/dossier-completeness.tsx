"use client";

import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  employeeMissingDocument,
  parseMissingDocumentFilter,
} from "@/lib/completeness/missing-document";
import { categoryFilterLabels, categoryLabels, categoryShort, type DocumentCategory } from "@/lib/document-category";
import type { CategoryCompleteness, EmployeeCompleteness } from "@/lib/search/documents";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applySort, type SortDirection } from "@/lib/sort";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

type SortKey = "displayName" | "matricule" | "service" | "missingCount";

const PAGE_SIZE = 10;

type DocumentCoverageStat = {
  key: string;
  label: string;
  category: DocumentCategory;
  /** Salariés pour lesquels ce document est obligatoire (catégorie applicable). */
  requiredCount: number;
  /** Parmi eux, ceux qui ont le fichier. */
  presentCount: number;
  /** presentCount / requiredCount (0 si aucun obligatoire). */
  rate: number;
};

function buildDocumentCoverageStats(
  employees: EmployeeCompleteness[],
  trackedCategories: DocumentCategory[],
): DocumentCoverageStat[] {
  const map = new Map<
    string,
    {
      key: string;
      label: string;
      category: DocumentCategory;
      requiredCount: number;
      presentCount: number;
    }
  >();

  for (const employee of employees) {
    for (const category of employee.categories) {
      if (!category.applicable) continue;
      for (const doc of category.required) {
        const id = `${category.category}::${doc.key}`;
        const current = map.get(id) ?? {
          key: doc.key,
          label: doc.label,
          category: category.category,
          requiredCount: 0,
          presentCount: 0,
        };
        current.requiredCount += 1;
        if (doc.present) current.presentCount += 1;
        map.set(id, current);
      }
    }
  }

  return trackedCategories.flatMap((category) =>
    [...map.values()]
      .filter((entry) => entry.category === category && entry.requiredCount > 0)
      .map((entry) => ({
        ...entry,
        rate: entry.presentCount / entry.requiredCount,
      }))
      .sort((a, b) => a.rate - b.rate || a.label.localeCompare(b.label, "fr")),
  );
}

type DossierCompletenessProps = {
  employees: EmployeeCompleteness[];
  trackedCategories: DocumentCategory[];
  stats: { totalEmployees: number; totalDocuments: number };
  userRole: Role;
};

export function DossierCompleteness({
  employees,
  trackedCategories,
  stats,
  userRole,
}: DossierCompletenessProps) {
  const [query, setQuery] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [missingDoc, setMissingDoc] = useState("ALL");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "displayName",
    direction: "asc",
  });
  const [page, setPage] = useState(1);

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
    setPage(1);
  }

  const documentOptions = useMemo(() => {
    const byValue = new Map<string, { value: string; label: string; category: DocumentCategory }>();
    for (const employee of employees) {
      for (const category of employee.categories) {
        for (const doc of [...category.required, ...category.optional]) {
          const value = `${category.category}::${doc.key}`;
          if (!byValue.has(value)) {
            byValue.set(value, { value, label: doc.label, category: category.category });
          }
        }
      }
    }
    return trackedCategories.flatMap((category) =>
      [...byValue.values()]
        .filter((option) => option.category === category)
        .sort((a, b) => a.label.localeCompare(b.label, "fr")),
    );
  }, [employees, trackedCategories]);

  const documentCoverageStats = useMemo(
    () => buildDocumentCoverageStats(employees, trackedCategories),
    [employees, trackedCategories],
  );

  const missingTarget = parseMissingDocumentFilter(missingDoc);
  const missingLabel = missingTarget
    ? documentOptions.find((option) => option.value === missingDoc)?.label ?? missingTarget.key
    : null;

  const filtered = useMemo(() => {
    const target = parseMissingDocumentFilter(missingDoc);
    const tokens = normalize(query.trim()).split(" ").filter(Boolean);
    let list = employees;
    if (target) {
      list = list.filter((employee) =>
        employeeMissingDocument(employee, target.category, target.key),
      );
    }
    if (tokens.length > 0) {
      list = list.filter((e) => {
        const haystack = normalize(
          [e.displayName, e.matricule, e.service ?? "", e.poste ?? ""].join(" "),
        );
        return tokens.every((token) => haystack.includes(token));
      });
    }
    if (onlyIncomplete) {
      list = list.filter((e) => e.missingCount > 0);
    }
    return list;
  }, [employees, query, onlyIncomplete, missingDoc]);

  const sorted = useMemo(
    () => applySort(filtered, (e) => e[sort.key], sort.direction),
    [filtered, sort],
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  const incompleteCount = employees.filter((e) => e.missingCount > 0).length;
  const exportCount = missingTarget
    ? employees.filter((employee) =>
        employeeMissingDocument(employee, missingTarget.category, missingTarget.key),
      ).length
    : incompleteCount;
  const exportHref = missingTarget
    ? `/api/completeness/export?category=${encodeURIComponent(missingTarget.category)}&document=${encodeURIComponent(missingTarget.key)}`
    : "/api/completeness/export";
  const indexEmpty = stats.totalDocuments === 0;

  return (
    <div className="space-y-6">
      <header className="report-enter">
        <span className="mb-3 block h-0.5 w-8 rounded-full bg-primary" aria-hidden />
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          Complétude des dossiers
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Documents obligatoires selon le statut et la situation du salarié, mis à jour après chaque synchronisation.
        </p>
      </header>

      <div className="relative grid gap-3 sm:grid-cols-3">
        <CompletenessStat
          label="Salariés"
          value={employees.length}
          hint="Dossiers suivis"
          tone="violet"
          delayMs={40}
        />
        <CompletenessStat
          label="Incomplets"
          value={incompleteCount}
          hint="Il manque des pièces"
          tone="rose"
          delayMs={100}
        />
        <CompletenessStat
          label="Complets"
          value={employees.length - incompleteCount}
          hint="Toutes les pièces exigées"
          tone="cyan"
          delayMs={160}
        />
      </div>

      {indexEmpty && (
        <Panel className="report-enter border-[color-mix(in_oklch,var(--status-watch)_35%,var(--border))] bg-(--status-watch-soft) py-2.5" style={{ animationDelay: "200ms" }}>
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

      {trackedCategories.length === 0 && (
        <Panel className="report-enter" style={{ animationDelay: "200ms" }}>
          <p className="text-sm text-muted-foreground">
            Aucune catégorie de dossier ne vous est accessible — contactez un
            administrateur pour vérifier vos permissions.
          </p>
        </Panel>
      )}

      <section
        className="report-enter overflow-hidden rounded-3xl border border-border/80 bg-card shadow-elevation-md"
        style={{ animationDelay: "220ms" }}
      >
        <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/30 px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 lg:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 bg-white pl-8 text-sm"
                placeholder="Nom, matricule, service…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={missingDoc}
              onValueChange={(value) => {
                if (!value) return;
                setMissingDoc(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full bg-white text-sm lg:w-72" aria-label="Document manquant">
                <SelectValue placeholder="Sans un document précis">
                  {missingLabel ? `Sans ${missingLabel}` : "Tous les documents"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" className="max-h-80">
                <SelectItem value="ALL">Tous les documents</SelectItem>
                {trackedCategories.map((category) => {
                  const options = documentOptions.filter((option) => option.category === category);
                  if (options.length === 0) return null;
                  return (
                    <SelectGroup key={category}>
                      <SelectLabel>{categoryFilterLabels[category]}</SelectLabel>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            <div className="flex shrink-0 flex-wrap items-center gap-3 lg:ml-auto">
              <label className="flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <Switch
                  checked={onlyIncomplete}
                  onCheckedChange={(value) => {
                    setOnlyIncomplete(value);
                    setPage(1);
                  }}
                  aria-label="Afficher uniquement les dossiers incomplets"
                />
                Uniquement incomplets
              </label>
              <DocumentCoverageStatsDialog stats={documentCoverageStats} />
              <a
                href={exportHref}
                download
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold shadow-sm transition-all",
                  "bg-[#217346] text-white hover:bg-[#1a5c38] hover:shadow-md active:scale-[0.98]",
                  exportCount === 0 && "pointer-events-none opacity-45 shadow-none",
                )}
                title={
                  exportCount === 0
                    ? missingLabel
                      ? `Aucun salarié sans ${missingLabel}`
                      : "Aucun dossier obligatoire manquant à exporter"
                    : missingLabel
                      ? `Exporter les ${exportCount} salarié${exportCount > 1 ? "s" : ""} sans ${missingLabel}`
                      : `Exporter les documents obligatoires manquants (${exportCount} salarié${exportCount > 1 ? "s" : ""})`
                }
                aria-disabled={exportCount === 0}
              >
                <ExcelIcon className="size-3.5 shrink-0" />
                Exporter
              </a>
            </div>
          </div>
          {missingLabel && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{exportCount}</span>{" "}
              salarié{exportCount > 1 ? "s" : ""} sans {missingLabel}. L&apos;Excel reprend toute
              cette liste, pas seulement la page affichée.
            </p>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHeader
                label="Nom"
                sortKey="displayName"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
              />
              <SortableHeader
                label="Matricule"
                sortKey="matricule"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
                className="hidden sm:table-cell"
              />
              {trackedCategories.map((cat) => (
                <TableHead
                  key={cat}
                  className="h-8 text-center text-xs"
                  title={categoryLabels[cat]}
                >
                  {categoryShort[cat]}
                </TableHead>
              ))}
              <SortableHeader
                label="Restants"
                sortKey="missingCount"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
              />
              <TableHead className="h-8 w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((employee, rowIndex) => (
              <TableRow
                key={`${currentPage}-${employee.matricule}`}
                className="report-enter"
                style={{ animationDelay: `${280 + rowIndex * 45}ms` }}
              >
                <TableCell className="py-2">
                  <Link
                    href={`/dashboard/employees/${encodeURIComponent(employee.matricule)}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {employee.displayName}
                  </Link>
                </TableCell>
                <TableCell className="hidden py-2 font-mono text-xs text-muted-foreground sm:table-cell">
                  {employee.matricule}
                </TableCell>
                {trackedCategories.map((cat) => (
                  <CategoryCell
                    key={cat}
                    status={employee.categories.find((c) => c.category === cat)}
                  />
                ))}
                <TableCell className="py-2 text-center">
                  <Badge
                    variant={employee.missingCount > 0 ? "destructive" : "secondary"}
                    className="text-[10px]"
                    title="Documents importants encore manquants"
                  >
                    {employee.missingCount > 0 ? employee.missingCount : "Complet"}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 text-right">
                  <DetailButton employee={employee} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {sorted.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {employees.length === 0
              ? "Aucun salarié indexé — synchronisation requise."
              : missingLabel
                ? `Aucun salarié sans ${missingLabel}.`
                : "Aucun salarié trouvé."}
          </p>
        )}
        {sorted.length > 0 && (
          <CompletenessPagination
            page={currentPage}
            pageCount={pageCount}
            total={sorted.length}
            onPage={setPage}
          />
        )}
      </section>
    </div>
  );
}

function CompletenessPagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {from}–{to}
        </span>{" "}
        sur {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Précédent
        </Button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPage(number)}
            aria-current={number === page ? "page" : undefined}
            className={
              number === page
                ? "grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                : "grid size-8 place-items-center rounded-full text-xs font-medium text-muted-foreground hover:bg-accent hover:text-primary"
            }
          >
            {number}
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Suivant
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function CompletenessStat({
  label,
  value,
  hint,
  tone,
  delayMs = 0,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "violet" | "rose" | "cyan";
  delayMs?: number;
}) {
  const tones = {
    violet: "from-primary to-primary/40 text-primary",
    rose: "from-(--status-critical) to-(--status-critical)/40 text-(--status-critical)",
    cyan: "from-(--status-good) to-(--status-good)/40 text-(--status-good)",
  } as const;

  return (
    <div
      className="report-enter relative overflow-hidden rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-elevation-xs"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", tones[tone])}
        aria-hidden
      />
      <p className="pl-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={cn("mt-1 pl-2 text-2xl font-semibold tabular-nums", tones[tone].split(" ").at(-1))}>
        {value}
      </p>
      <p className="mt-0.5 pl-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function CategoryCell({ status }: { status: CategoryCompleteness | undefined }) {
  if (!status || !status.applicable) {
    return (
      <TableCell className="py-2 text-center text-xs text-muted-foreground" title="Non applicable">
        —
      </TableCell>
    );
  }

  const totalRequired = status.required.length;
  const presentRequired = status.required.filter((r) => r.present).length;
  const remainingImportant = totalRequired - presentRequired;
  const fileCount = status.fileCount;

  // No obligatory docs → inventory only
  if (totalRequired === 0) {
    return (
      <TableCell
        className="py-2 text-center"
        title={`${fileCount} document${fileCount === 1 ? "" : "s"} indexé${fileCount === 1 ? "" : "s"} (aucun obligatoire)`}
      >
        <Badge variant="secondary" className="text-[10px]">
          {fileCount}
        </Badge>
      </TableCell>
    );
  }

  const complete = remainingImportant === 0;

  return (
    <TableCell
      className="py-2 text-center"
      title={`Obligatoires : ${presentRequired}/${totalRequired} — Indexés dans cette catégorie : ${fileCount}`}
    >
      <Badge variant={complete ? "secondary" : "destructive"} className="text-[10px]">
        {presentRequired}/{totalRequired}
      </Badge>
      <span className="mt-0.5 block text-[10px] text-muted-foreground">{fileCount} doc.</span>
    </TableCell>
  );
}

function DetailButton({ employee }: { employee: EmployeeCompleteness }) {
  const [open, setOpen] = useState(false);

  const presentCount = employee.categories.reduce(
    (n, cat) => n + cat.required.filter((d) => d.present).length,
    0,
  );
  const requiredCount = employee.categories.reduce((n, cat) => n + cat.required.length, 0);
  const optionalTotal = employee.categories.reduce((n, cat) => n + cat.optional.length, 0);
  const progressPct = requiredCount > 0 ? Math.round((presentCount / requiredCount) * 100) : 100;

  const sortedCategories = useMemo(() => {
    return [...employee.categories].sort((a, b) => {
      const missA = a.applicable ? a.required.filter((d) => !d.present).length : 0;
      const missB = b.applicable ? b.required.filter((d) => !d.present).length : 0;
      if (missA !== missB) return missB - missA;
      return 0;
    });
  }, [employee.categories]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="xs">Détail</Button>} />
      <DialogContent className="gap-0 overflow-hidden border-border/60 p-0 sm:max-w-2xl">
        <DialogHeader className="relative overflow-hidden border-b border-border/70 px-5 py-4 text-left">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"
            aria-hidden
          />
          <DialogTitle className="text-base">{employee.displayName}</DialogTitle>
          <p className="font-mono text-xs text-muted-foreground">{employee.matricule}</p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div
              className={cn(
                "rounded-xl border px-2.5 py-2.5 text-center shadow-sm",
                employee.missingCount > 0
                  ? "border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50"
                  : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-50",
              )}
            >
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums leading-none",
                  employee.missingCount > 0 ? "text-rose-600" : "text-emerald-600",
                )}
              >
                {employee.missingCount}
              </p>
              <p className="mt-1 text-[10px] font-medium text-rose-700/70">À compléter</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-2.5 py-2.5 text-center shadow-sm">
              <p className="text-lg font-semibold tabular-nums leading-none text-emerald-600">
                {presentCount}
              </p>
              <p className="mt-1 text-[10px] font-medium text-emerald-700/70">
                Présents / {requiredCount}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50 px-2.5 py-2.5 text-center shadow-sm">
              <p className="text-lg font-semibold tabular-nums leading-none text-sky-600">
                {optionalTotal}
              </p>
              <p className="mt-1 text-[10px] font-medium text-sky-700/70">Non exigés</p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-medium text-muted-foreground">Complétude obligatoire</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  progressPct >= 100
                    ? "bg-emerald-100 text-emerald-800"
                    : progressPct >= 70
                      ? "bg-sky-100 text-sky-800"
                      : progressPct >= 40
                        ? "bg-amber-100 text-amber-900"
                        : "bg-rose-100 text-rose-800",
                )}
              >
                {progressPct}%
              </span>
            </div>
            <div
              className={cn(
                "relative h-3.5 overflow-hidden rounded-full border border-black/5",
                progressPct >= 100
                  ? "bg-emerald-100"
                  : progressPct >= 70
                    ? "bg-sky-100"
                    : progressPct >= 40
                      ? "bg-amber-100"
                      : "bg-rose-100",
              )}
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                key={open ? `detail-bar-${employee.matricule}` : "closed"}
                className="coverage-bar-fill h-full rounded-full"
                style={
                  {
                    "--coverage-target": `${progressPct}%`,
                    backgroundImage: [
                      "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.45) 50%, transparent 75%)",
                      progressPct >= 100
                        ? "linear-gradient(90deg, #10b981 0%, #34d399 55%, #a3e635 100%)"
                        : progressPct >= 70
                          ? "linear-gradient(90deg, #06b6d4 0%, #3b82f6 55%, #6366f1 100%)"
                          : progressPct >= 40
                            ? "linear-gradient(90deg, #fbbf24 0%, #f97316 55%, #ef4444 100%)"
                            : "linear-gradient(90deg, #f43f5e 0%, #e11d48 45%, #a855f7 100%)",
                    ].join(", "),
                  } as React.CSSProperties
                }
              />
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto px-5 py-4">
          {sortedCategories.map((cat) => (
            <DetailCategoryBlock key={cat.category} cat={cat} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailCategoryBlock({ cat }: { cat: CategoryCompleteness }) {
  const [showOptional, setShowOptional] = useState(false);
  const present = cat.required.filter((d) => d.present).length;
  const total = cat.required.length;
  const missing = cat.required.filter((d) => !d.present);
  const presentDocs = cat.required.filter((d) => d.present);
  const hasMissing = missing.length > 0;

  if (!cat.applicable) {
    return (
      <section className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">{categoryFilterLabels[cat.category]}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Non applicable — salarié actif (dossiers de départ non requis).
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border",
        hasMissing ? "border-rose-200" : "border-emerald-200",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b px-3 py-2",
          hasMissing
            ? "border-rose-100 bg-gradient-to-r from-rose-50 to-orange-50"
            : "border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50",
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{categoryFilterLabels[cat.category]}</p>
          <p className="text-[10px] text-muted-foreground">
            {cat.fileCount} document{cat.fileCount === 1 ? "" : "s"} indexé{cat.fileCount === 1 ? "" : "s"}
            {cat.optional.length > 0 && ` · ${cat.optional.length} non exigé${cat.optional.length > 1 ? "s" : ""}`}
          </p>
        </div>
        {total > 0 ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tabular-nums",
              hasMissing ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
            )}
          >
            {present}/{total}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold text-sky-700">
            Aucun obligatoire
          </span>
        )}
      </div>

      <div className="space-y-3 px-3 py-2.5">
        {missing.length > 0 && (
          <DetailDocGroup title={`À compléter (${missing.length})`} tone="critical">
            {missing.map((doc) => (
              <li
                key={doc.key}
                className="flex items-center gap-2 rounded-lg border border-rose-100 bg-gradient-to-r from-rose-50 to-orange-50/80 px-2.5 py-1.5 text-xs"
              >
                <XCircle className="size-3.5 shrink-0 text-rose-500" />
                <span className="font-medium text-rose-900">{doc.label}</span>
              </li>
            ))}
          </DetailDocGroup>
        )}

        {presentDocs.length > 0 && (
          <DetailDocGroup title={`Présents (${presentDocs.length})`} tone="good">
            {presentDocs.map((doc) => (
              <li
                key={doc.key}
                className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50/70 px-2.5 py-1.5 text-xs"
              >
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                <span className="font-medium text-emerald-900">{doc.label}</span>
              </li>
            ))}
          </DetailDocGroup>
        )}

        {cat.optional.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[10px] font-semibold tracking-wide text-muted-foreground uppercase hover:bg-muted/40"
            >
              <span>Non exigés ({cat.optional.length})</span>
              <span className="font-normal normal-case">{showOptional ? "Masquer" : "Afficher"}</span>
            </button>
            {showOptional && (
              <ul className="mt-1.5 space-y-1">
                {cat.optional.map((doc) => (
                  <li
                    key={doc.key}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                      doc.present ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {doc.present ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-(--status-good)" />
                    ) : (
                      <FileText className="size-3.5 shrink-0 opacity-35" />
                    )}
                    <span>{doc.label}</span>
                    {doc.present && (
                      <span className="ml-auto text-[10px] text-(--status-good)">présent</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {total === 0 && cat.optional.length === 0 && cat.fileCount === 0 && (
          <p className="text-xs text-muted-foreground">Aucun document dans cette catégorie.</p>
        )}
      </div>
    </section>
  );
}

function DetailDocGroup({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "critical" | "good" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-1.5 text-[10px] font-semibold tracking-wide uppercase",
          tone === "critical" && "text-rose-600",
          tone === "good" && "text-emerald-600",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {title}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function coverageBarStyle(percent: number): {
  track: string;
  fill: string;
  badge: string;
} {
  if (percent >= 100) {
    return {
      track: "bg-emerald-100",
      fill: "linear-gradient(90deg, #10b981 0%, #34d399 55%, #a3e635 100%)",
      badge: "bg-emerald-100 text-emerald-800",
    };
  }
  if (percent >= 70) {
    return {
      track: "bg-sky-100",
      fill: "linear-gradient(90deg, #06b6d4 0%, #3b82f6 55%, #6366f1 100%)",
      badge: "bg-sky-100 text-sky-800",
    };
  }
  if (percent >= 40) {
    return {
      track: "bg-amber-100",
      fill: "linear-gradient(90deg, #fbbf24 0%, #f97316 55%, #ef4444 100%)",
      badge: "bg-amber-100 text-amber-900",
    };
  }
  return {
    track: "bg-rose-100",
    fill: "linear-gradient(90deg, #f43f5e 0%, #e11d48 45%, #a855f7 100%)",
    badge: "bg-rose-100 text-rose-800",
  };
}

function DocumentCoverageStatsDialog({ stats }: { stats: DocumentCoverageStat[] }) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const byCategory = new Map<DocumentCategory, DocumentCoverageStat[]>();
    for (const entry of stats) {
      const list = byCategory.get(entry.category) ?? [];
      list.push(entry);
      byCategory.set(entry.category, list);
    }
    return byCategory;
  }, [stats]);

  let rowIndex = 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-full px-3"
            title="Statistiques de complétude par document"
          >
            <BarChart3 className="size-3.5" />
            Stats
          </Button>
        }
      />
      <DialogContent className="flex max-h-[85vh] w-[min(96vw,52rem)] flex-col gap-0 overflow-hidden border-border/60 bg-card p-0 sm:max-w-4xl">
        <DialogHeader className="relative overflow-hidden border-b border-border/70 px-6 py-4 text-left">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"
            aria-hidden
          />
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="size-4" />
            </span>
            Complétude par document
          </DialogTitle>
          <DialogDescription>
            Pour chaque document : part de tous les salariés qui l&apos;ont déjà dans leur dossier.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {stats.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun document obligatoire à mesurer pour le moment.
            </p>
          ) : (
            <div key={open ? "stats-open" : "stats-closed"} className="space-y-5">
              {[...grouped.entries()].map(([category, entries]) => (
                <section key={category} className="space-y-3">
                  <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {categoryLabels[category]}
                  </h3>
                  <ul className="space-y-3">
                    {entries.map((entry) => {
                      const percent = Math.round(entry.rate * 100);
                      const style = coverageBarStyle(percent);
                      const delay = `${Math.min(rowIndex, 24) * 45}ms`;
                      rowIndex += 1;
                      return (
                        <li
                          key={`${entry.category}::${entry.key}`}
                          className="coverage-stat-row space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3.5"
                          style={{ animationDelay: delay }}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">
                              {entry.label}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                                style.badge,
                              )}
                            >
                              {entry.presentCount}/{entry.requiredCount} · {percent}%
                            </span>
                          </div>
                          <div
                            className={cn(
                              "relative h-4 overflow-hidden rounded-full border border-black/5",
                              style.track,
                            )}
                            role="progressbar"
                            aria-valuenow={percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${entry.label} : ${percent}%`}
                          >
                            <div
                              className="coverage-bar-fill relative h-full rounded-full"
                              style={
                                {
                                  "--coverage-target": `${percent}%`,
                                  animationDelay: `${delay}, ${delay}`,
                                  backgroundImage: [
                                    "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.45) 50%, transparent 75%)",
                                    style.fill,
                                  ].join(", "),
                                } as React.CSSProperties
                              }
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <rect x="3" y="2.5" width="18" height="19" rx="2.5" fill="white" fillOpacity="0.95" />
      <path
        d="M8.1 7.2h3.05L12 10.1l.85-2.9H16l-2.15 5.1L16 17.3h-3.1L12 14.3l-.9 3h-3.05l2.2-5.1L8.1 7.2z"
        fill="#217346"
      />
      <path d="M3 8.5h18M3 13h18M3 17.5h18M9.5 2.5v19" stroke="#217346" strokeOpacity="0.25" strokeWidth="1" />
    </svg>
  );
}
