import { PermissionsMatrix } from "@/components/admin/permissions-matrix";
import { PageHeader } from "@/components/layout/page-header";

export default function AdminPermissionsPage() {
  return (
    <div className="mx-auto w-full max-w-none space-y-4">
      <PageHeader
        title="Permissions"
        description="Droits par compte portail et sous-dossier Drive — enregistrés en base."
      />
      <PermissionsMatrix />
    </div>
  );
}
