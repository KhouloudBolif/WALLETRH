import { auth } from "@/auth";
import { QueryBuilder } from "@/components/dashboard/query-builder";
import { getResolvedAccessForUser, unauthenticatedAccess } from "@/lib/permissions/access-rules";
import { visibleCategories, visibleDocumentTypes } from "@/lib/permissions/defaults";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function RequetePage() {
  const session = await auth();
  const role = (session?.user?.role ?? "RH_AGENT") as Role;
  const viewerAccess = session?.user?.id
    ? await getResolvedAccessForUser(session.user.id, role)
    : unauthenticatedAccess("RH_AGENT");

  return (
    <QueryBuilder
      userName={session?.user?.name ?? "Utilisateur"}
      userRole={role}
      allowedCategories={visibleCategories(viewerAccess)}
      allowedDocumentTypes={visibleDocumentTypes(viewerAccess)}
    />
  );
}
