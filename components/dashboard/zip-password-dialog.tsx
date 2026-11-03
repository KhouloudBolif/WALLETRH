"use client";

import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zipPasswordSchema } from "@/lib/validations/zip-password";

type ZipPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
  loading?: boolean;
};

export function ZipPasswordDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: ZipPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPassword("");
    setConfirm("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = zipPasswordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Mot de passe invalide.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setError(null);
    onConfirm(parsed.data);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4" />
            Protéger le ZIP
          </DialogTitle>
          <DialogDescription>
            Choisissez un mot de passe. Il est demandé seulement pour ouvrir ou
            extraire le ZIP. Les fichiers à l’intérieur restent sans mot de passe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="zip-password">Mot de passe</Label>
            <Input
              id="zip-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              minLength={6}
              maxLength={128}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="zip-password-confirm">Confirmer</Label>
            <Input
              id="zip-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
              minLength={6}
              maxLength={128}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Minimum 6 caractères. Une fois le ZIP extrait, les PDF et les autres
            fichiers s’ouvrent directement. Ouvrez le ZIP avec <strong>7-Zip</strong>.
            Le fichier s’appelle <strong>export-documents-date.zip</strong>.
          </p>
          <DialogFooter className="mt-1">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => handleOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Export…" : "Exporter avec mot de passe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
