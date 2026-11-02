import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AccountSettings } from "@/components/settings/account-settings";
import { PageHeader } from "@/components/layout/page-header";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mon compte"
        description={
          session.user.role === "ADMIN"
            ? "Mettez à jour votre profil ou votre mot de passe."
            : "Mettez à jour votre profil. Seul un administrateur peut changer un mot de passe."
        }
      />
      <AccountSettings
        initialName={user.name}
        initialEmail={user.email}
        canChangePassword={session.user.role === "ADMIN"}
      />
    </div>
  );
}
