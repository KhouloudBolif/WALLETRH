import Link from "next/link";
import { CloudOff, FileStack, Shield, Users } from "lucide-react";
import { FeatureCard } from "@/components/layout/feature-card";
import { StatChip, StatRow } from "@/components/layout/stat-chip";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { prisma } from "@/lib/db";
import { getSyncOverview } from "@/lib/sync/syncDriveIndex";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function AdminOverviewStats() {
  const [portalUserCount, employeeCount, fileCount] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { archivedAt: null } }),
    prisma.driveFile.count(),
  ]);

  return (
    <StatRow>
      <StatChip label="Salariés" value={employeeCount} />
      <StatChip label="Documents" value={fileCount} />
      <StatChip label="Comptes portail" value={portalUserCount} />
    </StatRow>
  );
}

export function AdminQuickLinks() {
  const links = [
    {
      href: "/admin/sync",
      icon: CloudOff,
      title: "Synchronisation",
      description: "Historique des synchronisations Drive",
    },
    {
      href: "/admin/permissions",
      icon: Shield,
      title: "Permissions",
      description: "Droits par sous-dossier, comptes réels",
    },
    {
      href: "/admin/users",
      icon: Users,
      title: "Utilisateurs",
      description: "Comptes portail et test SMTP",
    },
    {
      href: "/dashboard/search",
      icon: FileStack,
      title: "Recherche RH",
      description: "Vue agent",
    },
  ];

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {links.map((link) => (
        <FeatureCard key={link.href} {...link} />
      ))}
    </div>
  );
}

export async function AdminRecentActivity() {
  const { lastLog } = await getSyncOverview();

  return (
    <Panel elevated>
      <PanelHeader
        title="Dernière synchronisation"
        description={
          lastLog
            ? `${formatDateTime(lastLog.startedAt)} · ${lastLog.source}`
            : "Jamais synchronisé"
        }
      />
      <dl className="grid grid-cols-3 gap-2 text-center">
        <ActivityMetric label="Ajoutés" value={`+${lastLog?.filesAdded ?? 0}`} />
        <ActivityMetric label="MAJ" value={String(lastLog?.filesUpdated ?? 0)} />
        <ActivityMetric label="Supprimés" value={`−${lastLog?.filesRemoved ?? 0}`} />
      </dl>
      <Link
        href="/admin/sync"
        className="mt-3 inline-block text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
      >
        Voir l&apos;historique →
      </Link>
    </Panel>
  );
}

function ActivityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 px-2 py-2">
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="font-serif text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}
