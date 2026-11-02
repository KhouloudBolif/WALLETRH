import { SyncStatusCard, type SyncLogRow, type SyncOverviewProps } from "@/components/admin/sync-status-card";
import { PageHeader } from "@/components/layout/page-header";
import { getSyncOverview } from "@/lib/sync/syncDriveIndex";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const { lastLog, history, employeeCount, fileCount } = await getSyncOverview();

  const serializeLog = (log: (typeof history)[number]): SyncLogRow => ({
    id: log.id,
    startedAt: log.startedAt.toISOString(),
    finishedAt: log.finishedAt?.toISOString() ?? null,
    status: log.status,
    source: log.source,
    employeesIndexed: log.employeesIndexed,
    filesAdded: log.filesAdded,
    filesUpdated: log.filesUpdated,
    filesRemoved: log.filesRemoved,
    errorMessage: log.errorMessage,
  });

  const initial: SyncOverviewProps = {
    lastLog: lastLog ? serializeLog(lastLog) : null,
    history: history.map(serializeLog),
    employeeCount,
    fileCount,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Synchronisation"
        description="Index PostgreSQL des dossiers salariés (source : Google Apps Script)"
      />
      <SyncStatusCard initial={initial} />
    </div>
  );
}
