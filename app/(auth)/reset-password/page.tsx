import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Nouveau mot de passe"
      description="Choisissez un mot de passe sécurisé pour votre compte."
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
