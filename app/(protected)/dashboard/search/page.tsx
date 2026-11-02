import { Suspense } from "react";
import { auth } from "@/auth";
import { DocumentSearch } from "@/components/dashboard/document-search";
import { getIndexStats } from "@/lib/search/documents";
import { getResolvedAccessForUser, unauthenticatedAccess } from "@/lib/permissions/access-rules";
import { visibleCategories, visibleDocumentTypes } from "@/lib/permissions/defaults";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DocumentSearchPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "RH_AGENT") as Role;
  const viewerAccess = session?.user?.id
    ? await getResolvedAccessForUser(session.user.id, role)
    : unauthenticatedAccess("RH_AGENT");
  const stats = await getIndexStats();

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement…</div>}>
      <DocumentSearch
        userName={session?.user?.name ?? "Utilisateur"}
        userRole={role}
        stats={stats}
        allowedCategories={visibleCategories(viewerAccess)}
        allowedDocumentTypes={visibleDocumentTypes(viewerAccess)}
      />
    </Suspense>
  );
}
