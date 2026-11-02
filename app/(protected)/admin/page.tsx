import Link from "next/link";
import {
  AdminOverviewStats,
  AdminQuickLinks,
  AdminRecentActivity,
} from "@/components/admin/admin-overview-stats";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";

export default async function AdminOverviewPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Vue d'ensemble"
        description="Tableau de bord administrateur"
      />

      <AdminOverviewStats />
      <AdminQuickLinks />

      <div className="grid gap-3 lg:grid-cols-2">
        <AdminRecentActivity />
        <Panel elevated>
          <PanelHeader title="Suite du projet" />
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-medium text-foreground">En cours</span>
              Droits par salarié (pas seulement par sous-dossier)
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">À prévoir</span>
              Journal d&apos;audit (accès document, changements de permission)
            </li>
          </ol>
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Retour à l&apos;accueil
          </Link>
        </Panel>
      </div>
    </div>
  );
}
