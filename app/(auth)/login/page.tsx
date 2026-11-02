import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getRoleHomePath } from "@/lib/auth/redirect";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.role) {
    redirect(getRoleHomePath(session.user.role));
  }

  return (
    <AuthShell
      title="Connexion"
      description="Connectez-vous avec votre compte RH pour accéder aux documents."
      showHomeLink
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement…</div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
