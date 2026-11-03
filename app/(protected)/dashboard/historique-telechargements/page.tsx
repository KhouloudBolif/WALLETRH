import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DownloadHistoryView } from "@/components/dashboard/download-history";
import { PageHeader } from "@/components/layout/page-header";
import { getDownloadHistory } from "@/lib/downloads/history";

export const dynamic = "force-dynamic";

export default async function DownloadHistoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = session.user.role as Role;
  const isAdmin = role === "ADMIN";
  const history = await getDownloadHistory({
    userId: session.user.id,
    role,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Historique téléchargement"
        description={
          isAdmin
            ? "Journal de tous les dossiers ZIP téléchargés via Requête ou Recherche."
            : "Journal de vos dossiers ZIP téléchargés via Requête ou Recherche."
        }
      />
      <DownloadHistoryView initial={history} isAdmin={isAdmin} />
    </div>
  );
}
