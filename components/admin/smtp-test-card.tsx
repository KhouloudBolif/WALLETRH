"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelHeader } from "@/components/ui/panel";

type SmtpTestCardProps = {
  smtpConfigured: boolean;
  defaultEmail?: string;
};

export function SmtpTestCard({
  smtpConfigured,
  defaultEmail = "",
}: SmtpTestCardProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);

  async function sendTest() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/mail/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success(data.message);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Configuration email (SMTP)"
        description={
          smtpConfigured
            ? "SMTP détecté dans .env — envoyez un email de test."
            : "Ajoutez SMTP_HOST, SMTP_USER et SMTP_PASS dans .env, puis redémarrez npm run dev."
        }
      />
      <div className="space-y-4">
        {!smtpConfigured && (
          <div className="rounded-lg border border-dashed bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Exemple Gmail dans .env :</p>
            <pre className="mt-2 overflow-x-auto text-xs">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre@gmail.com
SMTP_PASS=mot-de-passe-application-16-caracteres
MAIL_FROM="Portail RH <votre@gmail.com>"`}
            </pre>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="test-email">Email de test</Label>
            <Input
              id="test-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              disabled={!smtpConfigured}
            />
          </div>
          <Button
            type="button"
            onClick={sendTest}
            disabled={!smtpConfigured || loading || !email}
          >
            {loading && <Loader2 className="animate-spin" />}
            Envoyer test
          </Button>
        </div>
      </div>
    </Panel>
  );
}
