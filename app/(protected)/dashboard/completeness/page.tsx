import { auth } from "@/auth";
import { DossierCompleteness } from "@/components/dashboard/dossier-completeness";
import { getResolvedAccessForUser, unauthenticatedAccess } from "@/lib/permissions/access-rules";
import {
  getDossierCompleteness,
  getIndexStats,
  getViewerTrackedCategories,
} from "@/lib/search/documents";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CompletenessPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "RH_AGENT") as Role;
  const viewerAccess = session?.user?.id
    ? await getResolvedAccessForUser(session.user.id, role)
    : unauthenticatedAccess("RH_AGENT");

  const [employees, stats] = await Promise.all([
    getDossierCompleteness(viewerAccess),
    getIndexStats(),
  ]);

  return (
    <DossierCompleteness
      employees={employees}
      trackedCategories={getViewerTrackedCategories(viewerAccess)}
      stats={stats}
      userRole={role}
    />
  );
}
