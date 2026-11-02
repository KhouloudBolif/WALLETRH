import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Mot de passe oublié"
      description="Entrez votre email pour recevoir un lien de réinitialisation."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
