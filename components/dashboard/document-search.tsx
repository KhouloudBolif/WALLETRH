"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, Download, ExternalLink, FileText, Loader2, Lock } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { StatChip, StatRow } from "@/components/layout/stat-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { categoryFilterLabels, type DocumentCategory } from "@/lib/document-category";
import type { DocumentResult } from "@/lib/search/documents";
import { ZIP_EXPORT_ROW_LIMIT } from "@/lib/search/zip-export";
import { applySort, type SortDirection } from "@/lib/sort";
import { cn } from "@/lib/utils";
import { ActiveFiltersBar } from "@/components/dashboard/search-filters/active-filters";
import { FilterGroup } from "@/components/dashboard/filter-group";
import {
  IdentityFilters,
  IDENTITY_KEYS,
} from "@/components/dashboard/search-filters/identity-filters";
import { OrgFilters, ORG_KEYS } from "@/components/dashboard/search-filters/org-filters";
import { DatesFilters, DATES_KEYS } from "@/components/dashboard/search-filters/dates-filters";
import {
  DocumentFilters,
  DOCUMENT_KEYS,
} from "@/components/dashboard/search-filters/document-filters";
import { useFilterOptions } from "@/components/dashboard/search-filters/use-filter-options";
import { ZipPasswordDialog } from "@/components/dashboard/zip-password-dialog";
import { encryptZipBase64 } from "@/lib/search/protect-zip-download";
import {
  buildSearchParams,
  countActive,
  filtersReducer,
  hasActiveCriteria,
  initialFiltersState,
  parseSearchParams,
  type FiltersState,
} from "@/components/dashboard/search-filters/reducer";

const DEBOUNCE_MS = 300;

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrateur",
  RH_MANAGER: "Responsable RH",
  RH_AGENT: "Agent RH",
};

type DocumentSearchProps = {
  userName: string;
  userRole: Role;
  stats: {
    totalEmployees: number;
    totalDocuments: number;
    withThreePlusChildren: number;
  };
  allowedCategories: DocumentCategory[];
  allowedDocumentTypes: { value: string; label: string; category: DocumentCategory }[];
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

type ResultSortKey = "employee" | "fileName" | "category" | "modifiedAt";

function getResultSortValue(doc: DocumentResult, key: ResultSortKey): unknown {
  switch (key) {
    case "employee":
      return doc.employee.displayName;
    case "fileName":
      return doc.fileName;
    case "category":
      return categoryFilterLabels[doc.category];
    case "modifiedAt":
      return doc.modifiedAt;
  }
}

export function DocumentSearch({
  userName,
  userRole,
  stats,
  allowedCategories,
  allowedDocumentTypes,
}: DocumentSearchProps) {
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();
  const [state, dispatch] = useReducer(
    filtersReducer,
    searchParams,
    (params) => (params.toString() ? parseSearchParams(params) : initialFiltersState),
  );
  const patch = (partial: Partial<FiltersState>) => dispatch({ type: "patch", payload: partial });

  // Applique les critères venant de /dashboard/requete (navigation avec query string)
  useEffect(() => {
    if (!paramsKey) return;
    dispatch({ type: "patch", payload: parseSearchParams(new URLSearchParams(paramsKey)) });
  }, [paramsKey]);

  const filterOptions = useFilterOptions();

  const results = useResults(state);

  const [sort, setSort] = useState<{ key: ResultSortKey; direction: SortDirection } | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipPasswordOpen, setZipPasswordOpen] = useState(false);

  function receiveProtectedZip(
    popup: Window,
    appsScriptUrl: string,
    envelope: string,
    password: string,
    zipName: string,
  ): Promise<"ok" | "old-script" | "error"> {
    const action = appsScriptUrl.replace(/"/g, "&quot;");
    popup.document.open();
    popup.document.write(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:1rem">
      <p>Création du ZIP…</p>
      <form id="f" method="POST" action="${action}" accept-charset="UTF-8">
        <input type="hidden" name="envelope" id="e" />
      </form>
      <script>
        document.getElementById("e").value = ${JSON.stringify(envelope)};
        document.getElementById("f").submit();
      <\/script>
    </body></html>`);
    popup.document.close();

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: "ok" | "old-script" | "error") => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(result);
      };

      const onMessage = (ev: MessageEvent) => {
        const data = ev.data as { type?: string; zipBase64?: string } | null;
        if (!data?.type) return;
        if (data.type === "portail-rh-zip-b64" && data.zipBase64) {
          void (async () => {
            try {
              const encrypted = await encryptZipBase64(data.zipBase64 as string, password);
              const copy = new Uint8Array(encrypted.byteLength);
              copy.set(encrypted);
              const objectUrl = URL.createObjectURL(
                new Blob([copy], { type: "application/zip" }),
              );
              const a = document.createElement("a");
              a.href = objectUrl;
              a.download = zipName;
              a.click();
              URL.revokeObjectURL(objectUrl);
              try {
                popup.close();
              } catch {
                // ignore
              }
              finish("ok");
            } catch {
              finish("error");
            }
          })();
          return;
        }
        if (data.type === "portail-rh-zip-file") finish("old-script");
      };

      window.addEventListener("message", onMessage);
      const timer = window.setTimeout(() => finish("error"), 120_000);
    });
  }

  async function handleZipDownload(password: string) {
    const popup = window.open("about:blank", "portail_rh_zip_dl");
    if (!popup) {
      toast.error("Pop-up bloquée", {
        description: "Autorisez les pop-ups pour localhost, puis réessayez.",
      });
      return;
    }
    setZipLoading(true);
    const zipName = `export-documents-${new Date().toISOString().slice(0, 10)}.zip`;
    const params = buildSearchParams(state).toString();

    try {
      const prepareResponse = await fetch(
        `/api/search/documents/export-zip-prepare?${params}&source=recherche`,
      );
      const prepareData = await prepareResponse.json().catch(() => null);
      if (!prepareResponse.ok || !prepareData?.url || !prepareData?.envelope) {
        popup.close();
        toast.error("Export ZIP impossible", {
          description: prepareData?.error ?? "Impossible de préparer l'export ZIP.",
        });
        return;
      }

      setZipPasswordOpen(false);
      const result = await receiveProtectedZip(
        popup,
        prepareData.url as string,
        prepareData.envelope as string,
        password,
        zipName,
      );
      if (result === "ok") {
        toast.success("ZIP protégé téléchargé", {
          description: "Mot de passe requis pour ouvrir (7-Zip).",
        });
        return;
      }
      toast.error("ZIP protégé non reçu", {
        description:
          "Republiez la Web App Apps Script (ZIP-WEBAPP-COLLER.gs, nouvelle version) pour ne plus télécharger le ZIP ouvert.",
      });
    } catch {
      try {
        popup.close();
      } catch {
        // ignore
      }
      toast.error("Export ZIP impossible", {
        description: "Impossible de contacter le serveur ou Apps Script.",
      });
    } finally {
      setZipLoading(false);
    }
  }

  function handleSort(key: ResultSortKey) {
    setSort((prev) =>
      prev && prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  const sortedResults = useMemo(() => {
    if (!results.data || !sort) return results.data;
    return applySort(results.data, (doc) => getResultSortValue(doc, sort.key), sort.direction);
  }, [results.data, sort]);

  const active = hasActiveCriteria(state);
  const exportUrl = `/api/search/documents/export?${buildSearchParams(state).toString()}`;

  return (
    <div className="space-y-4">
      <ZipPasswordDialog
        open={zipPasswordOpen}
        onOpenChange={setZipPasswordOpen}
        onConfirm={handleZipDownload}
        loading={zipLoading}
      />

      <PageHeader
        title="Recherche documentaire"
        description={`${userName} · ${roleLabels[userRole]} — résultats en direct`}
      />

      <StatRow>
        <StatChip label="Salariés" value={stats.totalEmployees} />
        <StatChip label="Documents" value={stats.totalDocuments} />
        <StatChip label="3+ enfants" value={stats.withThreePlusChildren} />
      </StatRow>

      {stats.totalDocuments === 0 && (
        <Panel>
          <p className="text-sm text-muted-foreground">
            L&apos;index est vide. Un administrateur doit lancer la synchronisation
            depuis <span className="font-medium text-foreground">Synchronisation</span>.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
        <aside className="lg:sticky lg:top-4">
          <Panel>
            <PanelHeader
              title="Critères"
              description="Résultats en direct — toute info du salarié : CIN, nom, diplôme, zone, responsable…"
            />
            <div className="relative mb-3 min-w-0">
              <Input
                className="h-8 pr-8 shadow-xs"
                placeholder="AB123456, El Amrani, Casa Centre, Master…"
                value={state.query}
                onChange={(e) => patch({ query: e.target.value })}
                autoComplete="off"
              />
              {results.loading && (
                <Loader2 className="absolute top-1/2 right-2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="space-y-2">
              <FilterGroup
                title="Identité & état civil"
                activeCount={countActive(state, IDENTITY_KEYS)}
                defaultOpen
              >
                <IdentityFilters state={state} patch={patch} options={filterOptions} />
              </FilterGroup>
              <FilterGroup title="Poste & organisation" activeCount={countActive(state, ORG_KEYS)}>
                <OrgFilters state={state} patch={patch} options={filterOptions} />
              </FilterGroup>
              <FilterGroup title="Ancienneté & dates" activeCount={countActive(state, DATES_KEYS)}>
                <DatesFilters state={state} patch={patch} />
              </FilterGroup>
              <FilterGroup title="Document" activeCount={countActive(state, DOCUMENT_KEYS)}>
                <DocumentFilters
                  state={state}
                  patch={patch}
                  options={filterOptions}
                  allowedCategories={allowedCategories}
                  allowedDocumentTypes={allowedDocumentTypes}
                />
              </FilterGroup>
            </div>

            {active && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 h-7 w-full"
                onClick={() => dispatch({ type: "reset" })}
              >
                Réinitialiser tous les critères
              </Button>
            )}
          </Panel>
        </aside>

        <div className="min-w-0 space-y-3">
          {active && (
            <ActiveFiltersBar
              state={state}
              patch={patch}
              onClearAll={() => dispatch({ type: "reset" })}
            />
          )}

          {!active && !results.loading ? (
            <Panel>
              <div className="flex flex-col items-center py-10 text-center">
                <FileText className="size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-medium">Aucun critère sélectionné</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Utilisez la recherche ou les filtres à gauche pour afficher des résultats.
                </p>
              </div>
            </Panel>
          ) : (
            <Panel padding="none">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5 sm:px-4">
                <p className="text-xs text-muted-foreground">
                  {results.loading ? (
                    "Recherche en cours…"
                  ) : (
                    <>
                      <span className="font-medium text-foreground">
                        {sortedResults?.length ?? 0}
                      </span>{" "}
                      résultat{(sortedResults?.length ?? 0) !== 1 ? "s" : ""}
                    </>
                  )}
                  <span className="mx-1.5">·</span>
                  <Lock className="mr-0.5 inline size-3" />
                  refusé = sans lien
                </p>
                {active && (
                  <div className="flex shrink-0 items-center gap-3">
                    <a
                      href={exportUrl}
                      download
                      className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      title="Exporte tous les résultats correspondants (pas seulement ceux affichés)"
                    >
                      <Download className="size-3" />
                      Exporter (Excel)
                    </a>
                    <button
                      type="button"
                      onClick={() => setZipPasswordOpen(true)}
                      disabled={zipLoading}
                      className="inline-flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-50"
                      title={`Télécharge un ZIP protégé par mot de passe (max ${ZIP_EXPORT_ROW_LIMIT} documents)`}
                    >
                      {zipLoading ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Archive className="size-3" />
                      )}
                      Télécharger (ZIP)
                    </button>
                  </div>
                )}
              </div>
              {results.loading && results.data === null ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : sortedResults && sortedResults.length === 0 ? (
                <EmptyResults onReset={() => dispatch({ type: "reset" })} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <SortableHeader
                        label="Salarié"
                        sortKey="employee"
                        activeKey={sort?.key ?? null}
                        direction={sort?.direction ?? "asc"}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Document"
                        sortKey="fileName"
                        activeKey={sort?.key ?? null}
                        direction={sort?.direction ?? "asc"}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Cat."
                        sortKey="category"
                        activeKey={sort?.key ?? null}
                        direction={sort?.direction ?? "asc"}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Modifié"
                        sortKey="modifiedAt"
                        activeKey={sort?.key ?? null}
                        direction={sort?.direction ?? "asc"}
                        onSort={handleSort}
                        className="hidden md:table-cell"
                      />
                      <TableHead className="h-8 text-right text-xs">Accès</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedResults?.map((doc) => (
                      <ResultRow key={doc.id} doc={doc} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/** Debounced fetch against /api/search/documents, driven by the whole filters state. */
function useResults(state: FiltersState) {
  const [resultState, setResultState] = useReducer(
    (
      prev: { data: DocumentResult[] | null; loading: boolean },
      next: Partial<{ data: DocumentResult[] | null; loading: boolean }>,
    ) => ({ ...prev, ...next }),
    { data: null, loading: false },
  );

  useEffect(() => {
    if (!hasActiveCriteria(state)) {
      const id = setTimeout(() => {
        setResultState({ data: null, loading: false });
      }, 0);
      return () => clearTimeout(id);
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResultState({ loading: true });
      try {
        const params = buildSearchParams(state);
        const response = await fetch(`/api/search/documents?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          toast.error("Recherche impossible", {
            description: data.error ?? "Erreur inconnue.",
          });
          return;
        }
        setResultState({ data: data.results });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error("Recherche impossible", {
          description: "Impossible de contacter le serveur.",
        });
      } finally {
        if (!controller.signal.aborted) setResultState({ loading: false });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [state]);

  return resultState;
}

function ResultRow({ doc }: { doc: DocumentResult }) {
  const denied = !doc.authorized;

  return (
    <TableRow className={cn(denied && "opacity-55")}>
      <TableCell className="py-2">
        <Link
          href={`/dashboard/employees/${encodeURIComponent(doc.employee.matricule)}`}
          className={cn(
            "flex items-center gap-2.5",
            denied && "pointer-events-none",
          )}
        >
          <EmployeeAvatar name={doc.employee.displayName} size="xs" />
          <span className="min-w-0">
            <span
              className={cn(
                "block text-sm font-medium hover:underline",
                denied && "text-muted-foreground no-underline",
              )}
            >
              {doc.employee.displayName}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {doc.employee.matricule}
            </span>
          </span>
        </Link>
      </TableCell>
      <TableCell className="max-w-[180px] py-2">
        <span className={cn("truncate text-sm", denied && "text-muted-foreground")}>
          {doc.fileName}
        </span>
      </TableCell>
      <TableCell className="py-2">
        <Badge variant="outline" className="text-[10px]">
          {categoryFilterLabels[doc.category]}
        </Badge>
      </TableCell>
      <TableCell className="hidden py-2 text-xs text-muted-foreground md:table-cell">
        {formatDate(doc.modifiedAt)}
      </TableCell>
      <TableCell className="py-2 text-right">
        {doc.authorized && doc.viewUrl ? (
          <a
            href={doc.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
          >
            Ouvrir
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            <Lock className="size-3" />
            Refusé
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <FileText className="size-8 text-muted-foreground/40" />
      <p className="mt-2 text-sm font-medium">Aucun résultat</p>
      <Button variant="outline" size="sm" className="mt-3 h-7" onClick={onReset}>
        Réinitialiser
      </Button>
    </div>
  );
}
