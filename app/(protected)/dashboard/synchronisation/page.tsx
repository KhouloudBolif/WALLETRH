import { SyncStatusCard, type SyncLogRow, type SyncOverviewProps } from "@/components/admin/sync-status-card";
import { PageHeader } from "@/components/layout/page-header";
import { getSyncOverview } from "@/lib/sync/syncDriveIndex";

export const dynamic = "force-dynamic";

export default async function SynchronisationPage() {
  const overview = await getSyncOverview({ page: 1 });

  const serializeLog = (log: (typeof overview.history)[number]): SyncLogRow => ({
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
    triggeredBy: log.triggeredBy
      ? {
          id: log.triggeredBy.id,
          name: log.triggeredBy.name,
          email: log.triggeredBy.email,
        }
      : null,
  });

  const initial: SyncOverviewProps = {
    lastLog: overview.lastLog ? serializeLog(overview.lastLog) : null,
    history: overview.history.map(serializeLog),
    historyTotal: overview.historyTotal,
    page: overview.page,
    pageSize: overview.pageSize,
    pageCount: overview.pageCount,
    employeeCount: overview.employeeCount,
    fileCount: overview.fileCount,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Synchronisation"
        description="Rafraîchir les dossiers Drive pour alimenter l’application avec les nouvelles données."
      />
      <SyncStatusCard initial={initial} />
    </div>
  );
}
