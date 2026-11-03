"use client";

import { Download, FolderArchive, User } from "lucide-react";
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
import type { DownloadHistoryRow } from "@/lib/downloads/history";
import { applySort, type SortDirection } from "@/lib/sort";

const sourceLabels: Record<string, string> = {
  requete: "Requête",
  recherche: "Recherche",
};

type SortKey = "createdAt" | "fileCount" | "employeeCount" | "userName";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function DownloadHistoryView({
  initial,
  isAdmin,
}: {
  initial: DownloadHistoryRow[];
  isAdmin: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "createdAt",
    direction: "desc",
  });

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "createdAt" ? "desc" : "asc" },
    );
  }

  const sorted = useMemo(() => {
    return applySort(
      initial,
      (entry) => {
        if (sort.key === "userName") return entry.user.name;
        return entry[sort.key];
      },
      sort.direction,
    );
  }, [initial, sort]);

  const totalFiles = initial.reduce((sum, row) => sum + row.fileCount, 0);
  const totalEmployees = initial.reduce((sum, row) => sum + row.employeeCount, 0);

  return (
    <div className="space-y-4">
      <StatRow>
        <StatChip label="Téléchargements" value={initial.length} />
        <StatChip label="Fichiers exportés" value={totalFiles} />
        <StatChip label="Salariés concernés" value={totalEmployees} />
      </StatRow>

      <Panel padding="none">
        <PanelHeader
          className="border-b border-border/70 px-3 py-2.5 sm:px-4"
          title="Historique"
          description={
            isAdmin
              ? "Tous les téléchargements ZIP effectués sur le portail"
              : "Vos téléchargements ZIP uniquement"
          }
        />
        {initial.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <FolderArchive className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Aucun téléchargement enregistré pour le moment.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader
                  label="Date"
                  sortKey="createdAt"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={handleSort}
                />
                {isAdmin && (
                  <SortableHeader
                    label="Utilisateur"
                    sortKey="userName"
                    activeKey={sort.key}
                    direction={sort.direction}
                    onSort={handleSort}
                  />
                )}
                <TableHead className="h-8 text-xs">Fichier</TableHead>
                <TableHead className="h-8 text-xs">Origine</TableHead>
                <SortableHeader
                  label="Fichiers"
                  sortKey="fileCount"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={handleSort}
                  className="hidden sm:table-cell"
                />
                <SortableHeader
                  label="Salariés"
                  sortKey="employeeCount"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={handleSort}
                  className="hidden md:table-cell"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="py-2 text-xs whitespace-nowrap">
                    {formatDateTime(entry.createdAt)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <User className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">
                            {entry.user.name}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {entry.user.email}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <Download className="size-3.5 shrink-0 text-primary" />
                      <span className="font-medium">{entry.filename}</span>
                    </span>
                    {entry.summary && (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {entry.summary}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {sourceLabels[entry.source] ?? entry.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden py-2 text-xs tabular-nums sm:table-cell">
                    {entry.fileCount}
                  </TableCell>
                  <TableCell className="hidden py-2 text-xs tabular-nums md:table-cell">
                    {entry.employeeCount}
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
