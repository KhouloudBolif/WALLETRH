"use client";

import { BookmarkPlus, FolderOpen, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import type { SavedQueryDto } from "@/lib/search/saved-query";

type Snapshot = {
  filters: SavedQueryDto["filters"];
  activeFields: string[];
  exportColumns: string[];
};

export function SavedQueriesBar({
  snapshot,
  onApply,
}: {
  snapshot: Snapshot;
  onApply: (query: SavedQueryDto) => void;
}) {
  const [queries, setQueries] = useState<SavedQueryDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/search/saved-queries");
      const data = await response.json().catch(() => null);
      if (!response.ok) return;
      setQueries(Array.isArray(data?.queries) ? data.queries : []);
    } catch {
      // La liste reste vide : l'enregistrement affichera l'erreur au moment voulu.
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openSave() {
    if (snapshot.activeFields.length === 0 && snapshot.exportColumns.length === 0) {
      toast.error("Rien à enregistrer", {
        description: "Ajoutez au moins un filtre ou une colonne Excel.",
      });
      return;
    }
    setName("");
    setSaveOpen(true);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Nom trop court", {
        description: "Donnez au moins 2 caractères, par exemple « CDI par direction ».",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/search/saved-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          filters: snapshot.filters,
          activeFields: snapshot.activeFields,
          exportColumns: snapshot.exportColumns,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error("Enregistrement impossible", {
          description: data?.error ?? "Une erreur est survenue.",
        });
        return;
      }

      setSaveOpen(false);
      await refresh();
      toast.success(data.updated ? "Requête mise à jour" : "Requête enregistrée", {
        description: data.updated
          ? `« ${trimmed} » a été remplacée par la version actuelle.`
          : `« ${trimmed} » est dans Mes requêtes. Vous pourrez la recharger.`,
      });
    } catch {
      toast.error("Enregistrement impossible", {
        description: "Impossible de contacter le serveur.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(query: SavedQueryDto) {
    setDeletingId(query.id);
    try {
      const response = await fetch(`/api/search/saved-queries/${query.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error("Suppression impossible", {
          description: data?.error ?? "Une erreur est survenue.",
        });
        return;
      }
      setQueries((prev) => prev.filter((item) => item.id !== query.id));
      toast.success("Requête supprimée", { description: query.name });
    } catch {
      toast.error("Suppression impossible");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="inline-flex h-10 items-center self-start rounded-full border border-border/80 bg-card p-1 shadow-elevation-xs">
        <Button
          type="button"
          variant="ghost"
          className="h-8 rounded-full px-3 hover:bg-accent"
          onClick={openSave}
        >
          <BookmarkPlus className="size-3.5 text-primary" />
          Enregistrer
        </Button>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          className="h-8 rounded-full px-3 hover:bg-accent"
          onClick={() => {
            setListOpen(true);
            void refresh();
          }}
        >
          <FolderOpen className="size-3.5 text-gold-ink" />
          Mes requêtes
          {queries.length > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {queries.length}
            </span>
          )}
        </Button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer la requête</DialogTitle>
            <DialogDescription>
              Les filtres, leurs valeurs et les colonnes Excel sont conservés. Un nom déjà
              utilisé met à jour la requête existante.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="saved-query-name">Nom</Label>
            <Input
              id="saved-query-name"
              value={name}
              autoFocus
              maxLength={80}
              placeholder="Ex. CDI par direction"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSave();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              {snapshot.activeFields.length} filtre{snapshot.activeFields.length !== 1 ? "s" : ""} ·{" "}
              {snapshot.exportColumns.length} colonne{snapshot.exportColumns.length !== 1 ? "s" : ""}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <BookmarkPlus className="size-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Requêtes enregistrées</DialogTitle>
            <DialogDescription>
              Chargez une requête pour retrouver ses champs, ses valeurs et ses colonnes, sans
              les rechercher à nouveau.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {listLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : queries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune requête enregistrée. Construisez vos filtres, puis cliquez sur Enregistrer.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {queries.map((query) => (
                  <li key={query.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{query.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {query.activeFields.length} filtre{query.activeFields.length !== 1 ? "s" : ""} ·{" "}
                        {query.exportColumns.length} colonne{query.exportColumns.length !== 1 ? "s" : ""} ·{" "}
                        {formatSavedDate(query.updatedAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onApply(query);
                        setListOpen(false);
                      }}
                    >
                      Charger
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={deletingId === query.id}
                      aria-label={`Supprimer ${query.name}`}
                      onClick={() => void handleDelete(query)}
                    >
                      {deletingId === query.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatSavedDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
