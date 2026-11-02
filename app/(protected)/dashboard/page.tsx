import { auth } from "@/auth";
import { DashboardHub } from "@/components/dashboard/dashboard-hub";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <DashboardHub
      userId={session?.user?.id ?? null}
      userName={session?.user?.name ?? "Utilisateur"}
      userRole={(session?.user?.role ?? "RH_AGENT") as Role}
    />
  );
}
