import { auth } from "@/auth";
import { EmployeeDirectory } from "@/components/dashboard/employee-directory";
import { getResolvedAccessForUser, unauthenticatedAccess } from "@/lib/permissions/access-rules";
import { listEmployees } from "@/lib/search/documents";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "RH_AGENT") as Role;
  const viewerAccess = session?.user?.id
    ? await getResolvedAccessForUser(session.user.id, role)
    : unauthenticatedAccess("RH_AGENT");

  const employees = await listEmployees(viewerAccess);
  return <EmployeeDirectory employees={employees} />;
}
