"use client";

import { CloudOff, Database } from "lucide-react";
import { useMemo, useState } from "react";
import { StatChip, StatRow } from "@/components/layout/stat-chip";
import { Badge } from "@/components/ui/badge";
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
};

export type SyncOverviewProps = {
  lastLog: SyncLogRow | null;
  history: SyncLogRow[];
  employeeCount: number;
  fileCount: number;
};

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

type HistorySortKey = "startedAt" | "status" | "employeesIndexed";

export function SyncStatusCard({ initial }: { initial: SyncOverviewProps }) {
  const [historySort, setHistorySort] = useState<{
    key: HistorySortKey;
    direction: SortDirection;
  }>({ key: "startedAt", direction: "desc" });

  function handleHistorySort(key: HistorySortKey) {
    setHistorySort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "startedAt" ? "desc" : "asc" },
    );
  }

  const { lastLog, history, employeeCount, fileCount } = initial;
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
          {lastLog && (
            <Badge variant="outline" className="text-[10px]">
              {lastLog.source}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {fileCount > 0 ? (
            <>
              <Database className="mr-1 inline size-3" />
              La recherche interroge cet index PostgreSQL, alimenté par la synchronisation
              Google Apps Script.
            </>
          ) : (
            <>
              <CloudOff className="mr-1 inline size-3" />
              Index vide — la recherche ne renverra aucun résultat tant qu&apos;une
              synchronisation n&apos;a pas été reçue.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          La synchronisation est déclenchée côté Google Apps Script (exécution manuelle ou
          déclencheur planifié) — le portail ne peut pas interroger Drive lui-même et
          n&apos;affiche ici que l&apos;historique reçu. Voir{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
            doc/APPS_SCRIPT_SYNC_SETUP.md
          </code>{" "}
          pour la configuration et la planification du déclencheur.
        </p>
      </Panel>

      <Panel padding="none">
        <PanelHeader
          className="border-b border-border/70 px-3 py-2.5 sm:px-4"
          title="Historique"
          description="Journal des synchronisations (SyncLog)"
        />
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune synchronisation enregistrée.
          </p>
        ) : (
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
                <TableRow key={entry.id}>
                  <TableCell className="py-2 text-xs">
                    {formatDateTime(entry.startedAt)}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {formatDuration(entry.startedAt, entry.finishedAt)}
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
                      )}
                      title={entry.errorMessage ?? undefined}
                    >
                      {entry.status === "SUCCESS"
                        ? "OK"
                        : entry.status === "RUNNING"
                          ? "En cours"
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
        )}
      </Panel>
    </div>
  );
}
