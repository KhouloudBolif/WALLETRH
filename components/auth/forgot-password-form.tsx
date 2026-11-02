"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Email invalide"),
});

type FormValues = z.infer<typeof schema>;

type DevMailInfo = {
  devResetUrl?: string;
  devPreviewUrl?: string;
  devHint?: string;
};

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devMail, setDevMail] = useState<DevMailInfo | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setDevMail(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      setSent(true);
      if (data.dev && data.devResetUrl) {
        setDevMail({
          devResetUrl: data.devResetUrl,
          devPreviewUrl: data.devPreviewUrl,
          devHint: data.devHint,
        });
        toast.success("Lien de test généré (mode développement)");
      } else {
        toast.success(data.message);
      }
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Si un compte actif existe avec cet email, un lien de réinitialisation a
          été envoyé.
        </p>

        {devMail?.devResetUrl ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">Mode développement</p>
            <p className="mt-1 text-xs opacity-90">
              {devMail.devHint ??
                "Aucun email réel n'est envoyé sans configuration SMTP. Cliquez le lien direct :"}
            </p>
            <a
              href={devMail.devResetUrl}
              className="mt-3 inline-flex items-center gap-1 break-all text-sm font-medium underline"
            >
              Ouvrir la page de réinitialisation
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
            {devMail.devPreviewUrl && (
              <a
                href={devMail.devPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-xs underline opacity-80"
              >
                Voir l&apos;email de test sur Ethereal
              </a>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Vérifiez votre boîte mail. Si rien n&apos;arrive, l&apos;email n&apos;est
            peut‑être pas enregistré ou le compte est désactivé.
          </p>
        )}

        <Link
          href="/login"
          className="inline-block font-medium text-foreground hover:underline"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Seuls les emails enregistrés dans le portail peuvent recevoir un lien de
        réinitialisation.
      </p>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="vous@amendis.ma"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Envoyer le lien
      </Button>

      <Link
        href="/login"
        className="block text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Retour à la connexion
      </Link>
    </form>
  );
}
