import { auth } from "@/auth";
import { ReportingDashboard } from "@/components/dashboard/reporting/reporting-dashboard";
import { getResolvedAccessForUser, unauthenticatedAccess } from "@/lib/permissions/access-rules";
import { getCompletenessOverview, getWorkforceReport } from "@/lib/reporting/stats";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ReportingPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "RH_AGENT") as Role;
  const viewerAccess = session?.user?.id
    ? await getResolvedAccessForUser(session.user.id, role)
    : unauthenticatedAccess("RH_AGENT");

  const [workforce, completeness] = await Promise.all([
    getWorkforceReport(viewerAccess),
    getCompletenessOverview(viewerAccess),
  ]);

  return (
    <ReportingDashboard
      workforce={workforce.overall}
      directions={workforce.directions}
      completeness={completeness}
    />
  );
}
