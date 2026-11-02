import { auth } from "@/auth";
import { UserManagement } from "@/components/admin/user-management";
import { SmtpTestCard } from "@/components/admin/smtp-test-card";
import { PageHeader } from "@/components/layout/page-header";
import { isSmtpConfigured } from "@/lib/mail";

export default async function AdminUsersPage() {
  const session = await auth();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Utilisateurs"
        description="Comptes RH, mots de passe et configuration email."
      />
      <SmtpTestCard
        smtpConfigured={isSmtpConfigured()}
        defaultEmail={session?.user?.email ?? ""}
      />
      <UserManagement />
    </div>
  );
}
