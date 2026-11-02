"use client";

import { useRef, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { encryptZipBytes } from "@/lib/search/encrypt-zip";

type ZipProtectFromFileProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  password: string;
  suggestedName: string;
  onProtected: () => void;
};

/**
 * Quand Apps Script a déjà enregistré un ZIP non protégé (pop-up Google),
 * l'utilisateur sélectionne ce fichier et on le re-télécharge chiffré.
 * Aucune modification du script Apps Script.
 */
export function ZipProtectFromFileDialog({
  open,
  onOpenChange,
  password,
  suggestedName,
  onProtected,
}: ZipProtectFromFileProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const plain = new Uint8Array(await file.arrayBuffer());
      const encrypted = await encryptZipBytes(plain, password);
      const copy = new Uint8Array(encrypted.byteLength);
      copy.set(encrypted);
      const objectUrl = URL.createObjectURL(
        new Blob([copy], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = suggestedName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      onProtected();
      onOpenChange(false);
    } catch {
      setError("Impossible de protéger ce fichier. Vérifiez que c’est bien le ZIP exporté.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4" />
            Verrouiller le ZIP téléchargé
          </DialogTitle>
          <DialogDescription>
            Google a enregistré un ZIP <strong>sans</strong> mot de passe dans
            Téléchargements. Sélectionnez ce fichier pour créer la version
            protégée, puis <strong>supprimez</strong> le ZIP non verrouillé.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          disabled={loading}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Plus tard
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Lock className="size-4" />
            )}
            Choisir le ZIP à protéger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
