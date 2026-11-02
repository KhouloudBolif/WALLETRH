import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { EmployeeDossier } from "@/components/dashboard/employee-dossier";
import { getResolvedAccessForUser, unauthenticatedAccess } from "@/lib/permissions/access-rules";
import { getEmployeeWithDocuments } from "@/lib/search/documents";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ matricule: string }>;
};

export default async function EmployeeDossierPage({ params }: PageProps) {
  const { matricule } = await params;
  const session = await auth();

  const role = (session?.user?.role ?? "RH_AGENT") as Role;
  const viewerAccess = session?.user?.id
    ? await getResolvedAccessForUser(session.user.id, role)
    : unauthenticatedAccess("RH_AGENT");

  const data = await getEmployeeWithDocuments(
    decodeURIComponent(matricule),
    viewerAccess,
  );

  if (!data) {
    notFound();
  }

  return <EmployeeDossier employee={data.employee} documents={data.documents} />;
}
