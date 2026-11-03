"use client";

import {
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Database,
  Loader2,
  RefreshCw,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { StatChip, StatRow } from "@/components/layout/stat-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { applySort, type SortDirection } from "@/lib/sort";
import { cn } from "@/lib/utils";

export type SyncLogRow = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  source: string;
  employeesIndexed: number;
  filesAdded: number;
  filesUpdated: number;
  filesRemoved: number;
  errorMessage: string | null;
  triggeredBy: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type SyncOverviewProps = {
  lastLog: SyncLogRow | null;
  history: SyncLogRow[];
  historyTotal: number;
  page: number;
  pageSize: number;
  pageCount: number;
  employeeCount: number;
  fileCount: number;
};

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 12 * 60 * 1000;

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDuration(start: string, end: string | null) {
  if (!end) return "—";
  const sec = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function toIso(value: string | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

type RawLog = Omit<SyncLogRow, "startedAt" | "finishedAt"> & {
  startedAt: string | Date;
  finishedAt: string | Date | null;
};

function serializeOverview(raw: {
  lastLog: RawLog | null;
  history: RawLog[];
  historyTotal: number;
  page: number;
  pageSize: number;
  pageCount: number;
  employeeCount: number;
  fileCount: number;
}): SyncOverviewProps {
  const serializeLog = (log: RawLog & { triggeredBy?: SyncLogRow["triggeredBy"] }): SyncLogRow => ({
    id: log.id,
    startedAt: toIso(log.startedAt),
    finishedAt: log.finishedAt ? toIso(log.finishedAt) : null,
    status: log.status,
    source: log.source,
    employeesIndexed: log.employeesIndexed,
    filesAdded: log.filesAdded,
    filesUpdated: log.filesUpdated,
    filesRemoved: log.filesRemoved,
    errorMessage: log.errorMessage,
    triggeredBy: log.triggeredBy ?? null,
  });

  return {
    lastLog: raw.lastLog ? serializeLog(raw.lastLog) : null,
    history: raw.history.map(serializeLog),
    historyTotal: raw.historyTotal,
    page: raw.page,
    pageSize: raw.pageSize,
    pageCount: raw.pageCount,
    employeeCount: raw.employeeCount,
    fileCount: raw.fileCount,
  };
}

type HistorySortKey = "startedAt" | "status" | "employeesIndexed";
type SyncPhase = "idle" | "launching" | "waiting" | "running" | "done";

function syncBarGradient(percent: number): string {
  if (percent >= 100) {
    return "linear-gradient(90deg, #10b981 0%, #34d399 55%, #a3e635 100%)";
  }
  if (percent >= 70) {
    return "linear-gradient(90deg, #06b6d4 0%, #3b82f6 55%, #6366f1 100%)";
  }
  if (percent >= 40) {
    return "linear-gradient(90deg, #fbbf24 0%, #f97316 55%, #ef4444 100%)";
  }
  return "linear-gradient(90deg, #f43f5e 0%, #e11d48 45%, #a855f7 100%)";
}

export function SyncStatusCard({ initial }: { initial: SyncOverviewProps }) {
  const [overview, setOverview] = useState(initial);
  const [page, setPage] = useState(initial.page);
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [historySort, setHistorySort] = useState<{
    key: HistorySortKey;
    direction: SortDirection;
  }>({ key: "startedAt", direction: "desc" });
  const abortPollRef = useRef(false);
  const baselineFileCountRef = useRef(initial.fileCount);

  useEffect(() => {
    setOverview(initial);
    setPage(initial.page);
  }, [initial]);

  useEffect(() => {
    return () => {
      abortPollRef.current = true;
    };
  }, []);

  function handleHistorySort(key: HistorySortKey) {
    setHistorySort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "startedAt" ? "desc" : "asc" },
    );
  }

  async function fetchOverview(targetPage = 1): Promise<SyncOverviewProps | null> {
    const response = await fetch(`/api/sync/overview?page=${targetPage}&pageSize=${overview.pageSize}`);
    if (!response.ok) return null;
    const data = await response.json();
    return serializeOverview(data);
  }

  async function goToPage(nextPage: number) {
    const next = await fetchOverview(nextPage);
    if (!next) {
      toast.error("Impossible de charger l’historique.");
      return;
    }
    setOverview(next);
    setPage(next.page);
  }

  async function refreshOverview() {
    const next = await fetchOverview(page);
    if (next) {
      setOverview(next);
      setPage(next.page);
    }
  }

  function receiveSyncResult(popup: Window): Promise<"ok" | "error"> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: "ok" | "error") => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(result);
      };

      const onMessage = (ev: MessageEvent) => {
        const data = ev.data as { type?: string } | null;
        if (!data?.type) return;
        if (data.type === "portail-rh-sync-ok") {
          try {
            popup.close();
          } catch {
            // ignore
          }
          finish("ok");
          return;
        }
        if (data.type === "portail-rh-sync-error") {
          try {
            popup.close();
          } catch {
            // ignore
          }
          finish("error");
        }
      };

      window.addEventListener("message", onMessage);
      const timer = window.setTimeout(() => finish("error"), 90_000);
    });
  }

  async function watchSyncUntilDone(baselineIds: Set<string>, triggeredAtMs: number) {
    abortPollRef.current = false;
    setPhase("waiting");
    setProgress(18);
    setStatusLabel("En attente du démarrage Apps Script…");
    setPage(1);

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const targetFiles = Math.max(baselineFileCountRef.current, 1);
    let trackedId: string | null = null;
    let waitTicks = 0;

    while (Date.now() < deadline) {
      if (abortPollRef.current) return "aborted" as const;

      await new Promise((r) => window.setTimeout(r, POLL_INTERVAL_MS));
      if (abortPollRef.current) return "aborted" as const;

      const next = await fetchOverview(1);
      if (!next) continue;
      setOverview(next);
      setPage(1);

      const candidates = next.history.filter((entry) => {
        const startedMs = new Date(entry.startedAt).getTime();
        const isNew = !baselineIds.has(entry.id) || startedMs >= triggeredAtMs - 5_000;
        return isNew && startedMs >= triggeredAtMs - 15_000;
      });

      const running = candidates.find((entry) => entry.status === "RUNNING");
      const finished = candidates.find(
        (entry) => entry.status === "SUCCESS" || entry.status === "FAILED",
      );

      if (running) {
        trackedId = running.id;
        const processed = running.filesAdded + running.filesUpdated + running.filesRemoved;
        const estimated = Math.min(
          92,
          Math.max(35, Math.round(30 + (processed / targetFiles) * 60)),
        );
        setPhase("running");
        setProgress(estimated);
        setStatusLabel(
          `Synchronisation en cours… ${running.employeesIndexed} salariés · +${running.filesAdded} / ~${running.filesUpdated}`,
        );
        continue;
      }

      const done =
        (trackedId
          ? next.history.find((entry) => entry.id === trackedId)
          : null) ?? finished;

      if (done && (done.status === "SUCCESS" || done.status === "FAILED")) {
        setPhase("done");
        setProgress(100);
        setStatusLabel(
          done.status === "SUCCESS"
            ? "Synchronisation terminée"
            : "Synchronisation échouée",
        );
        await new Promise((r) => window.setTimeout(r, 900));
        setPhase("idle");
        setStatusLabel(null);
        setProgress(0);
        return done;
      }

      if (!trackedId) {
        waitTicks += 1;
        setProgress(Math.min(32, 18 + waitTicks * 2));
        setStatusLabel("En attente du démarrage Apps Script…");
      }
    }

    setPhase("idle");
    setStatusLabel(null);
    setProgress(0);
    return "timeout" as const;
  }

  async function handleTriggerSync() {
    const popup = window.open("about:blank", "portail_rh_sync");
    if (!popup) {
      toast.error("Pop-up bloquée", {
        description: "Autorisez les pop-ups pour localhost, puis réessayez.",
      });
      return;
    }

    const baselineIds = new Set(overview.history.map((entry) => entry.id));
    const triggeredAtMs = Date.now();
    baselineFileCountRef.current = overview.fileCount;

    setPhase("launching");
    setProgress(8);
    setStatusLabel("Ouverture de Google Apps Script…");

    try {
      const response = await fetch("/api/sync/trigger", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url || !data?.envelope) {
        popup.close();
        setPhase("idle");
        setStatusLabel(null);
        setProgress(0);
        toast.error("Synchronisation impossible", {
          description: data?.error ?? `Erreur HTTP ${response.status}`,
        });
        return;
      }

      const action = String(data.url).replace(/"/g, "&quot;");
      popup.document.open();
      popup.document.write(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:1rem">
        <p>Lancement de la synchronisation…</p>
        <form id="f" method="POST" action="${action}" accept-charset="UTF-8">
          <input type="hidden" name="envelope" id="e" />
        </form>
        <script>
          document.getElementById("e").value = ${JSON.stringify(data.envelope)};
          document.getElementById("f").submit();
        <\/script>
      </body></html>`);
      popup.document.close();

      const result = await receiveSyncResult(popup);
      if (result !== "ok") {
        setPhase("idle");
        setStatusLabel(null);
        setProgress(0);
        toast.error("Synchronisation impossible", {
          description:
            "Connectez-vous à Google (compte Veolia) dans la pop-up, puis réessayez. Vérifiez aussi que sync.gs est redéployé.",
        });
        return;
      }

      setProgress(15);

      toast.message("Synchronisation démarrée", {
        description: "Suivi en cours — le tableau se mettra à jour automatiquement.",
      });

      const outcome = await watchSyncUntilDone(baselineIds, triggeredAtMs);

      if (outcome === "aborted") return;

      if (outcome === "timeout") {
        toast.error("Délai dépassé", {
          description:
            "La synchro tourne peut-être encore côté Google. Cliquez Actualiser dans 1–2 min.",
        });
        await goToPage(1);
        return;
      }

      if (outcome.status === "SUCCESS") {
        toast.success("Synchronisation terminée", {
          description: `${outcome.employeesIndexed} salariés · +${outcome.filesAdded} / ~${outcome.filesUpdated} / −${outcome.filesRemoved}`,
        });
      } else {
        toast.error("Synchronisation échouée", {
          description: outcome.errorMessage ?? "Voir le détail dans l’historique.",
        });
      }
    } catch {
      try {
        popup.close();
      } catch {
        // ignore
      }
      setPhase("idle");
      setStatusLabel(null);
      setProgress(0);
      toast.error("Synchronisation impossible", {
        description: "Impossible de contacter le serveur ou Apps Script.",
      });
    }
  }

  const busy = phase !== "idle";
  const showProgress = busy && progress > 0;
  const { lastLog, history, historyTotal, pageCount, pageSize, employeeCount, fileCount } =
    overview;
  const neverSynced = !lastLog;
  const sortedHistory = useMemo(
    () => applySort(history, (entry) => entry[historySort.key], historySort.direction),
    [history, historySort],
  );

  return (
    <div className="space-y-4">
      <StatRow>
        <StatChip label="Salariés indexés" value={employeeCount} />
        <StatChip label="Fichiers indexés" value={fileCount} />
        <StatChip label="Ajoutés (dernière)" value={`+${lastLog?.filesAdded ?? 0}`} />
        <StatChip label="MAJ (dernière)" value={lastLog?.filesUpdated ?? 0} />
      </StatRow>

      <Panel elevated>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PanelHeader
            className="mb-0"
            title="Index PostgreSQL"
            description={
              neverSynced
                ? "Aucune synchronisation reçue pour le moment"
                : `Dernière synchronisation : ${formatDateTime(lastLog.startedAt)}`
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            {lastLog && (
              <Badge variant="outline" className="text-[10px]">
                {lastLog.source}
              </Badge>
            )}
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleTriggerSync()}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {phase === "launching"
                ? "Lancement…"
                : phase === "waiting"
                  ? "En attente…"
                  : phase === "running"
                    ? "En cours…"
                    : phase === "done"
                      ? "Terminé"
                      : "Synchroniser"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void refreshOverview()}
              title="Actualiser l’historique"
            >
              Actualiser
            </Button>
          </div>
        </div>

        {showProgress && (
          <div className="mt-4 space-y-2.5 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-xs text-foreground">
                {phase === "done" ? (
                  <span className="grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    ✓
                  </span>
                ) : (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                )}
                <span className="min-w-0 truncate font-medium">
                  {statusLabel ?? "Synchronisation…"}
                </span>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  progress >= 100
                    ? "bg-emerald-100 text-emerald-800"
                    : progress >= 70
                      ? "bg-sky-100 text-sky-800"
                      : progress >= 40
                        ? "bg-amber-100 text-amber-900"
                        : "bg-rose-100 text-rose-800",
                )}
              >
                {Math.round(progress)}%
              </span>
            </div>
            <div
              className="relative h-4 overflow-hidden rounded-full border border-black/5 bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Avancement synchronisation : ${Math.round(progress)}%`}
            >
              <div
                className="sync-progress-fill h-full rounded-full"
                style={{
                  width: `${Math.max(progress, 4)}%`,
                  backgroundImage: [
                    "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.45) 50%, transparent 75%)",
                    syncBarGradient(progress),
                  ].join(", "),
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {phase === "launching" && "Connexion à Google Apps Script…"}
              {phase === "waiting" && "Démarrage du script Drive / Base…"}
              {phase === "running" && "Indexation des dossiers salariés en cours…"}
              {phase === "done" && "Historique mis à jour."}
            </p>
          </div>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          {fileCount > 0 ? (
            <>
              <Database className="mr-1 inline size-3" />
              La synchronisation permet de rafraîchir les fichiers Drive avec
              l&apos;application pour l&apos;alimenter avec les nouvelles données.
            </>
          ) : (
            <>
              <CloudOff className="mr-1 inline size-3" />
              Index vide — lancez une synchronisation pour alimenter l&apos;application
              avec les données Drive.
            </>
          )}
        </p>
      </Panel>

      <Panel padding="none">
        <PanelHeader
          className="border-b border-border/70 px-3 py-2.5 sm:px-4"
          title="Historique"
          description={
            busy
              ? "Mise à jour automatique pendant la synchronisation…"
              : `Enregistré en base (SyncLog) · ${historyTotal} synchronisation${historyTotal > 1 ? "s" : ""}`
          }
        />
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune synchronisation enregistrée.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                <SortableHeader
                  label="Date"
                  sortKey="startedAt"
                  activeKey={historySort.key}
                  direction={historySort.direction}
                  onSort={handleHistorySort}
                />
                <TableHead className="h-8 text-xs">Utilisateur</TableHead>
                <TableHead className="h-8 text-xs">Durée</TableHead>
                  <SortableHeader
                    label="Statut"
                    sortKey="status"
                    activeKey={historySort.key}
                    direction={historySort.direction}
                    onSort={handleHistorySort}
                  />
                  <SortableHeader
                    label="Salariés"
                    sortKey="employeesIndexed"
                    activeKey={historySort.key}
                    direction={historySort.direction}
                    onSort={handleHistorySort}
                    className="hidden sm:table-cell"
                  />
                  <TableHead className="h-8 text-right text-xs">+ / ~ / −</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHistory.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className={cn(entry.status === "RUNNING" && "bg-primary/5")}
                  >
                    <TableCell className="py-2 text-xs">
                      {formatDateTime(entry.startedAt)}
                    </TableCell>
                    <TableCell className="py-2">
                      {entry.triggeredBy ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <User className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block font-medium text-foreground">
                              {entry.triggeredBy.name}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              {entry.triggeredBy.email}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Planifiée (Apps Script)</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {entry.status === "RUNNING"
                        ? "…"
                        : formatDuration(entry.startedAt, entry.finishedAt)}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          entry.status === "SUCCESS" &&
                            "border-transparent bg-(--status-good-soft) text-(--status-good)",
                          entry.status === "FAILED" &&
                            "border-transparent bg-(--status-critical-soft) text-(--status-critical)",
                          entry.status === "RUNNING" &&
                            "border-transparent bg-primary/10 text-primary",
                        )}
                        title={entry.errorMessage ?? undefined}
                      >
                        {entry.status === "SUCCESS"
                          ? "OK"
                          : entry.status === "RUNNING"
                            ? (
                                <span className="inline-flex items-center gap-1">
                                  <Loader2 className="size-3 animate-spin" />
                                  En cours
                                </span>
                              )
                            : "Échec"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden py-2 text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {entry.employeesIndexed}
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono text-xs tabular-nums">
                      +{entry.filesAdded} / {entry.filesUpdated} / −{entry.filesRemoved}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <SyncHistoryPagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={historyTotal}
              disabled={busy}
              onPage={(next) => void goToPage(next)}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

function SyncHistoryPagination({
  page,
  pageCount,
  pageSize,
  total,
  disabled,
  onPage,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  disabled?: boolean;
  onPage: (page: number) => void;
}) {
  if (total <= 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const maxButtons = 5;
  const start = Math.max(1, Math.min(page - Math.floor(maxButtons / 2), pageCount - maxButtons + 1));
  const end = Math.min(pageCount, start + maxButtons - 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">
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
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Précédent
        </Button>
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            disabled={disabled}
            onClick={() => onPage(number)}
            aria-current={number === page ? "page" : undefined}
            className={
              number === page
                ? "grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                : "grid size-8 place-items-center rounded-full text-xs font-medium text-muted-foreground hover:bg-accent hover:text-primary disabled:opacity-50"
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
          disabled={disabled || page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Suivant
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
