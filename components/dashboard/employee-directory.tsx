"use client";

import { useRouter } from "next/navigation";
import { Archive, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { StatChip } from "@/components/layout/stat-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { applySort, type SortDirection } from "@/lib/sort";
import type { EmployeeSummary } from "@/lib/search/documents";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

type SortKey = "displayName" | "matricule" | "cin" | "service" | "documentCount" | "childrenCount";

const PAGE_SIZE = 10;

function dossierHref(matricule: string) {
  return `/dashboard/employees/${encodeURIComponent(matricule)}`;
}

export function EmployeeDirectory({ employees }: { employees: EmployeeSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showArchive, setShowArchive] = useState(false);
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

  const activeEmployees = useMemo(
    () => employees.filter((employee) => !employee.archivedAt),
    [employees],
  );
  const archivedEmployees = useMemo(
    () => employees.filter((employee) => employee.archivedAt),
    [employees],
  );

  const filtered = useMemo(() => {
    const tokens = normalize(query.trim()).split(" ").filter(Boolean);
    if (tokens.length === 0) return activeEmployees;
    return activeEmployees.filter((e) => tokens.every((token) => e.searchText.includes(token)));
  }, [activeEmployees, query]);

  const filteredArchived = useMemo(() => {
    const tokens = normalize(query.trim()).split(" ").filter(Boolean);
    if (tokens.length === 0) return archivedEmployees;
    return archivedEmployees.filter((e) => tokens.every((token) => e.searchText.includes(token)));
  }, [archivedEmployees, query]);

  const sorted = useMemo(
    () => applySort(filtered, (e) => e[sort.key], sort.direction),
    [filtered, sort],
  );
  const sortedArchived = useMemo(
    () => applySort(filteredArchived, (e) => e[sort.key], sort.direction),
    [filteredArchived, sort],
  );

  const shownCount = showArchive ? filteredArchived.length : filtered.length;
  const pageCount = Math.max(1, Math.ceil(shownCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const activeRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);
  const archivedRows = sortedArchived.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Annuaire salariés"
        description={
          activeEmployees.length > 0
            ? `${activeEmployees.length} salariés présents dans la feuille Base`
            : "Index vide — lancez la synchronisation (menu Synchronisation)"
        }
      >
        <StatChip label="Actifs" value={activeEmployees.length} />
        <StatChip label="Archives" value={archivedEmployees.length} />
        <StatChip label="Affichés" value={shownCount} />
      </PageHeader>

      <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-elevation-md">
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-full bg-muted/40 pl-9"
              placeholder="Nom, matricule, CIN, diplôme, zone…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Rechercher un salarié"
            />
          </div>
          <div className="flex items-center gap-2">
            {query && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                Effacer
              </Button>
            )}
            <div className="inline-flex rounded-full border border-border/80 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setShowArchive(false);
                  setPage(1);
                }}
                className={
                  showArchive
                    ? "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground"
                    : "inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-primary shadow-elevation-xs"
                }
              >
                <Users className="size-3.5" />
                Actifs
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowArchive(true);
                  setPage(1);
                }}
                className={
                  showArchive
                    ? "inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-primary shadow-elevation-xs"
                    : "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground"
                }
              >
                <Archive className="size-3.5" />
                Archives
                <span className="tabular-nums">{archivedEmployees.length}</span>
              </button>
            </div>
          </div>
        </div>

        {showArchive ? (
          <>
            <p className="border-b border-border/70 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
              Salariés retirés de la feuille Base. Leur dossier Drive reste consultable.
            </p>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-11 px-5 text-[11px] tracking-wide text-muted-foreground uppercase">Nom</TableHead>
                  <TableHead className="h-11 text-[11px] tracking-wide text-muted-foreground uppercase">Matricule</TableHead>
                  <TableHead className="hidden h-11 text-[11px] tracking-wide text-muted-foreground uppercase md:table-cell">CIN</TableHead>
                  <TableHead className="hidden h-11 text-[11px] tracking-wide text-muted-foreground uppercase sm:table-cell">Service</TableHead>
                  <TableHead className="h-11 text-[11px] tracking-wide text-muted-foreground uppercase">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedRows.map((employee) => (
                  <TableRow
                    key={employee.matricule}
                    className="cursor-pointer hover:bg-accent/50"
                    tabIndex={0}
                    onClick={() => router.push(dossierHref(employee.matricule))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(dossierHref(employee.matricule));
                      }
                    }}
                  >
                    <TableCell className="py-3.5 pl-5">
                      <span className="flex items-center gap-3">
                        <EmployeeAvatar name={employee.displayName} size="sm" />
                        <span className="text-sm font-medium">{employee.displayName}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 font-mono text-xs text-muted-foreground">{employee.matricule}</TableCell>
                    <TableCell className="hidden py-3.5 font-mono text-xs text-muted-foreground md:table-cell">
                      {employee.cin ?? "—"}
                    </TableCell>
                    <TableCell className="hidden py-3.5 text-sm text-muted-foreground sm:table-cell">
                      {employee.service ?? "—"}
                    </TableCell>
                    <TableCell className="py-3.5 pr-5">
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        Archivé
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sortedArchived.length === 0 && (
              <DirectoryEmpty
                title={archivedEmployees.length === 0 ? "Aucune archive" : "Aucune archive trouvée"}
                text={
                  archivedEmployees.length === 0
                    ? "Une personne apparaît ici quand elle n'est plus dans la feuille Base, après une synchronisation."
                    : "Aucune archive ne correspond à la recherche."
                }
              />
            )}
          </>
        ) : (
        <>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHeader
                label="Nom"
                sortKey="displayName"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
                className="h-11 pl-3"
              />
              <SortableHeader
                label="Matricule"
                sortKey="matricule"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
                className="h-11"
              />
              <SortableHeader
                label="CIN"
                sortKey="cin"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
                className="hidden h-11 md:table-cell"
              />
              <SortableHeader
                label="Service"
                sortKey="service"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
                className="hidden h-11 sm:table-cell"
              />
              <SortableHeader
                label="Docs"
                sortKey="documentCount"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
                className="h-11"
              />
              <SortableHeader
                label="Enfants"
                sortKey="childrenCount"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
                className="h-11"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeRows.map((employee) => (
              <TableRow
                key={employee.matricule}
                className="cursor-pointer hover:bg-accent/50"
                tabIndex={0}
                onClick={() => router.push(dossierHref(employee.matricule))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(dossierHref(employee.matricule));
                  }
                }}
              >
                <TableCell className="py-3.5 pl-5">
                  <span className="flex items-center gap-3">
                    <EmployeeAvatar name={employee.displayName} size="sm" />
                    <span className="text-sm font-medium">
                      {employee.displayName}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="py-3.5 font-mono text-xs text-muted-foreground">
                  {employee.matricule}
                </TableCell>
                <TableCell className="hidden py-3.5 font-mono text-xs text-muted-foreground md:table-cell">
                  {employee.cin ?? "—"}
                </TableCell>
                <TableCell className="hidden py-3.5 text-sm text-muted-foreground sm:table-cell">
                  {employee.service ?? "—"}
                </TableCell>
                <TableCell className="py-3.5">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-accent px-2 text-xs font-semibold text-primary tabular-nums">
                    {employee.documentCount}
                  </span>
                </TableCell>
                <TableCell className="py-3.5 pr-5 text-sm tabular-nums text-muted-foreground">
                  {employee.childrenCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length === 0 && (
          <DirectoryEmpty
            title={activeEmployees.length === 0 ? "Aucun salarié actif" : "Aucun salarié trouvé"}
            text={
              activeEmployees.length === 0
                ? "Lancez une synchronisation pour remplir l'annuaire."
                : "Aucun dossier ne correspond à cette recherche."
            }
          />
        )}
        </>
        )}
        {shownCount > 0 && (
          <DirectoryPagination
            page={currentPage}
            pageCount={pageCount}
            total={shownCount}
            onPage={setPage}
          />
        )}
      </section>
    </div>
  );
}

function DirectoryPagination({
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
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
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

function DirectoryEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent text-primary">
        <Users className="size-5" />
      </span>
      <p className="text-sm font-semibold tracking-tight">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
