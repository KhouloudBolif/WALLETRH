"use client";

import {
  Columns3,
  Download,
  FileText,
  GripVertical,
  Loader2,
  Lock,
  MousePointerClick,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterField } from "@/components/dashboard/search-filters/filter-field";
import { DateRangeFilterControl } from "@/components/dashboard/search-filters/dates-filters";
import { FilterSelect, MultiFilterSelect } from "@/components/dashboard/search-filters/filter-select";
import {
  buildSearchParams,
  filtersReducer,
  hasActiveCriteria,
  initialFiltersState,
  type FiltersState,
} from "@/components/dashboard/search-filters/reducer";
import { useFilterOptions } from "@/components/dashboard/search-filters/use-filter-options";
import { ZipPasswordDialog } from "@/components/dashboard/zip-password-dialog";
import { categoryFilterLabels, type DocumentCategory } from "@/lib/document-category";
import type { DocumentResult } from "@/lib/search/documents";
import {
  encryptZipBase64,
  zipBytesToBlob,
} from "@/lib/search/protect-zip-download";
import { isExportColumnId, getExportColumnHeader, type ExportColumnId } from "@/lib/search/export-columns";
import { cn } from "@/lib/utils";

const DRAG_THRESHOLD_PX = 6;

const GROUP_ACCENT: Record<string, string> = {
  Général: "bg-foreground/35",
  Identité: "bg-primary",
  Organisation: "bg-gold-ink",
  Dates: "bg-teal-600",
  Document: "bg-rose-600",
};

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrateur",
  RH_MANAGER: "Responsable RH",
  RH_AGENT: "Agent RH",
};

type QueryFieldId =
  | keyof FiltersState
  | "query"
  | "docLink"
  | "docUrl"
  | "dateEntree"
  | "dateDepart"
  | "modifiedDate";

type QueryFieldDef = {
  id: QueryFieldId;
  label: string;
  group: string;
};

/** Champs sans paramètre filtre (colonnes Excel uniquement). */
const EXPORT_ONLY_FIELDS = new Set<QueryFieldId>(["docLink", "docUrl"]);

const QUERY_FIELDS: QueryFieldDef[] = [
  { id: "matricule", label: "Matricule", group: "Identité" },
  { id: "nom", label: "Nom", group: "Identité" },
  { id: "prenom", label: "Prénom", group: "Identité" },
  { id: "genre", label: "Genre", group: "Identité" },
  { id: "cin", label: "CIN", group: "Identité" },
  { id: "ageRange", label: "Âge", group: "Identité" },
  { id: "minChildren", label: "Enfants (au moins)", group: "Identité" },
  { id: "childrenExact", label: "Enfants (exact)", group: "Identité" },
  { id: "hasSpouseDocument", label: "Document conjoint", group: "Identité" },
  { id: "childName", label: "Prénom enfant", group: "Identité" },
  { id: "managerMatricule", label: "Matricule responsable", group: "Identité" },
  { id: "situation", label: "Situation", group: "Identité" },
  { id: "direction", label: "Direction", group: "Organisation" },
  { id: "service", label: "Service", group: "Organisation" },
  { id: "entite", label: "Entité", group: "Organisation" },
  { id: "sousEntite", label: "Sous-entité", group: "Organisation" },
  { id: "zone", label: "Zone", group: "Organisation" },
  { id: "agence", label: "Agence", group: "Organisation" },
  { id: "poste", label: "Poste", group: "Organisation" },
  { id: "statut", label: "Statut", group: "Organisation" },
  { id: "college", label: "Collège", group: "Organisation" },
  { id: "admTech", label: "Adm / Tech", group: "Organisation" },
  { id: "position", label: "Position", group: "Organisation" },
  { id: "encadrant", label: "Encadrant", group: "Organisation" },
  { id: "categorieRh", label: "Catégorie RH", group: "Organisation" },
  { id: "niveau", label: "Niveau", group: "Organisation" },
  { id: "grade", label: "Grade", group: "Organisation" },
  { id: "ancienneteRange", label: "Ancienneté", group: "Dates" },
  { id: "dateEntree", label: "Date d'entrée", group: "Dates" },
  { id: "dateDepart", label: "Date de départ", group: "Dates" },
  { id: "category", label: "Catégorie document", group: "Document" },
  { id: "documentTypes", label: "Type de document", group: "Document" },
  { id: "docLink", label: "Lien document", group: "Document" },
];

type QueryBuilderProps = {
  userName: string;
  userRole: Role;
  allowedCategories: DocumentCategory[];
  allowedDocumentTypes: { value: string; label: string; category: DocumentCategory }[];
};

type DragSession = {
  id: QueryFieldId;
  label: string;
  startX: number;
  startY: number;
  active: boolean;
};

export function QueryBuilder({
  userName,
  userRole,
  allowedCategories,
  allowedDocumentTypes,
}: QueryBuilderProps) {
  const [state, dispatch] = useReducer(filtersReducer, initialFiltersState);
  const patch = (partial: Partial<FiltersState>) => dispatch({ type: "patch", payload: partial });
  const filterOptions = useFilterOptions();

  const [activeFields, setActiveFields] = useState<QueryFieldId[]>([]);
  const [exportColumns, setExportColumns] = useState<ExportColumnId[]>([]);
  const [draggingId, setDraggingId] = useState<QueryFieldId | null>(null);
  const [dropHover, setDropHover] = useState<"export" | "filter" | null>(null);
  const [ghost, setGhost] = useState<{ label: string; x: number; y: number } | null>(null);
  const [launching, setLaunching] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [results, setResults] = useState<DocumentResult[] | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [exportParams, setExportParams] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [zipPasswordOpen, setZipPasswordOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");

  const dropExportRef = useRef<HTMLDivElement>(null);
  const dropParamsRef = useRef<HTMLDivElement>(null);
  const libraryScrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);

  const fieldById = useMemo(
    () => Object.fromEntries(QUERY_FIELDS.map((f) => [f.id, f])) as Record<QueryFieldId, QueryFieldDef>,
    [],
  );

  /** Toujours tous les champs : un champ peut servir au filtre ET à l’export. */
  const availableByGroup = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    const groups = new Map<string, QueryFieldDef[]>();
    for (const field of QUERY_FIELDS) {
      if (q && !field.label.toLowerCase().includes(q) && !field.group.toLowerCase().includes(q)) {
        continue;
      }
      const list = groups.get(field.group) ?? [];
      list.push(field);
      groups.set(field.group, list);
    }
    return groups;
  }, [libraryQuery]);

  useLayoutEffect(() => {
    const el = libraryScrollRef.current;
    if (!el) return;
    const pinTop = () => {
      el.scrollTop = 0;
    };
    pinTop();
    const frame = requestAnimationFrame(pinTop);
    const timer = window.setTimeout(pinTop, 50);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [libraryQuery]);

  const addField = useCallback((id: QueryFieldId) => {
    if (EXPORT_ONLY_FIELDS.has(id)) {
      if (isExportColumnId(id)) {
        setExportColumns((prev) => (prev.includes(id) ? prev : [...prev, id]));
        toast.message("Ajouté aux colonnes Excel", {
          description: fieldById[id]?.label ?? id,
        });
      }
      return;
    }
    setActiveFields((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, [fieldById]);

  const addExportColumn = useCallback((id: QueryFieldId) => {
    const mapped: ExportColumnId | null =
      id === "dateEntree"
        ? "dateEntreeFrom"
        : id === "dateDepart"
          ? "dateDepartFrom"
          : id === "modifiedDate"
            ? "modifiedFrom"
            : isExportColumnId(id)
              ? id
              : null;
    if (!mapped) {
      toast.error("Ce champ n’est pas exportable", {
        description: "Choisissez un champ identité, organisation ou document.",
      });
      return;
    }
    setExportColumns((prev) => (prev.includes(mapped) ? prev : [...prev, mapped]));
  }, []);

  const removeField = useCallback((id: QueryFieldId) => {
    setActiveFields((prev) => prev.filter((f) => f !== id));
    if (EXPORT_ONLY_FIELDS.has(id)) return;
    if (id === "query") {
      dispatch({ type: "patch", payload: { query: "" } });
      return;
    }
    if (id === "dateEntree") {
      dispatch({
        type: "patch",
        payload: { dateEntreeFrom: "", dateEntreeTo: "", dateEntreeMode: "interval" },
      });
      return;
    }
    if (id === "dateDepart") {
      dispatch({
        type: "patch",
        payload: { dateDepartFrom: "", dateDepartTo: "", dateDepartMode: "interval" },
      });
      return;
    }
    if (id === "modifiedDate") {
      dispatch({
        type: "patch",
        payload: { modifiedFrom: "", modifiedTo: "", modifiedMode: "interval" },
      });
      return;
    }
    if (id in initialFiltersState) {
      dispatch({
        type: "patch",
        payload: { [id]: initialFiltersState[id as keyof FiltersState] } as Partial<FiltersState>,
      });
    }
  }, []);

  const removeExportColumn = useCallback((id: ExportColumnId) => {
    setExportColumns((prev) => prev.filter((f) => f !== id));
  }, []);

  const isPointIn = useCallback((el: HTMLElement | null, clientX: number, clientY: number) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }, []);

  const resolveDropZone = useCallback(
    (clientX: number, clientY: number): "export" | "filter" | null => {
      if (isPointIn(dropExportRef.current, clientX, clientY)) return "export";
      if (isPointIn(dropParamsRef.current, clientX, clientY)) return "filter";
      return null;
    },
    [isPointIn],
  );

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const session = dragRef.current;
      if (!session) return;

      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      if (!session.active && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

      if (!session.active) {
        session.active = true;
        setDraggingId(session.id);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }

      setGhost({ label: session.label, x: e.clientX, y: e.clientY });
      setDropHover(resolveDropZone(e.clientX, e.clientY));
    }

    function onPointerUp(e: PointerEvent) {
      const session = dragRef.current;
      dragRef.current = null;
      if (!session) return;

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDraggingId(null);
      setDropHover(null);
      setGhost(null);

      const zone = resolveDropZone(e.clientX, e.clientY);
      if (session.active && zone === "export") {
        addExportColumn(session.id);
        return;
      }
      if (session.active && zone === "filter") {
        addField(session.id);
        return;
      }
      // Clic simple (ou relâche hors zone) → filtre
      addField(session.id);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [addField, addExportColumn, resolveDropZone]);

  function onFieldPointerDown(e: ReactPointerEvent, field: QueryFieldDef) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      id: field.id,
      label: field.label,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
  }

  function buildExportQueryString() {
    const params = buildSearchParams(state);
    for (const col of exportColumns) {
      params.append("columns", col);
    }
    return params.toString();
  }

  // Garder les params d’export à jour si on change les colonnes après le lancement
  useEffect(() => {
    if (!resultsOpen) return;
    if (!hasActiveCriteria(state)) return;
    setExportParams(buildExportQueryString());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync colonnes Excel seulement
  }, [exportColumns, resultsOpen]);

  async function handleLaunch() {
    if (activeFields.length === 0) {
      toast.error("Aucun champ sélectionné", {
        description: "Glissez ou cliquez un champ à gauche pour l'ajouter à la barre filtre.",
      });
      return;
    }
    if (!hasActiveCriteria(state)) {
      toast.error("Renseignez les valeurs", {
        description:
          "Choisissez une valeur pour chaque champ dans « Paramètres de la requête ».",
      });
      return;
    }

    const params = buildExportQueryString();
    setExportParams(params);
    setResults(null);
    setResultsError(null);
    setResultsOpen(true);
    setLaunching(true);

    try {
      const response = await fetch(`/api/search/documents?${buildSearchParams(state).toString()}`);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.error ?? "Erreur inconnue.";
        setResultsError(message);
        toast.error("Requête impossible", { description: message });
        return;
      }

      setResults(data.results ?? []);
    } catch {
      setResultsError("Impossible de contacter le serveur.");
      toast.error("Requête impossible", {
        description: "Impossible de contacter le serveur.",
      });
    } finally {
      setLaunching(false);
    }
  }

  function triggerBlobDownload(blob: Blob, filename: string) {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Révoquer trop tôt annule le téléchargement dans Chrome
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  function downloadEncryptedZip(encrypted: Uint8Array, filename: string) {
    triggerBlobDownload(zipBytesToBlob(encrypted), filename);
  }

  /**
   * Ouvre la page relais Apps Script (sans formulaire).
   * Elle renvoie le ZIP en base64. On chiffre ici et on télécharge
   * uniquement le fichier protégé — jamais le ZIP ouvert.
   */
  function receiveProtectedZip(
    popup: Window,
    appsScriptUrl: string,
    envelope: string,
    password: string,
    zipName: string,
  ): Promise<"ok" | "old-script" | "error"> {
    const action = appsScriptUrl.replace(/"/g, "&quot;");
    popup.document.open();
    popup.document.write(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:1rem">
      <p>Création du ZIP…</p>
      <form id="f" method="POST" action="${action}" accept-charset="UTF-8">
        <input type="hidden" name="envelope" id="e" />
      </form>
      <script>
        document.getElementById("e").value = ${JSON.stringify(envelope)};
        document.getElementById("f").submit();
      <\/script>
    </body></html>`);
    popup.document.close();

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: "ok" | "old-script" | "error") => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(result);
      };

      const onMessage = (ev: MessageEvent) => {
        const data = ev.data as { type?: string; zipBase64?: string } | null;
        if (!data?.type) return;

        if (data.type === "portail-rh-zip-b64" && data.zipBase64) {
          void (async () => {
            try {
              const encrypted = await encryptZipBase64(data.zipBase64 as string, password);
              downloadEncryptedZip(encrypted, zipName);
              try {
                popup.close();
              } catch {
                // ignore
              }
              finish("ok");
            } catch {
              finish("error");
            }
          })();
          return;
        }

        // Ancienne Web App : elle déclenche elle-même le ZIP sans mot de passe.
        if (data.type === "portail-rh-zip-file") {
          finish("old-script");
        }
      };

      window.addEventListener("message", onMessage);
      const timer = window.setTimeout(() => finish("error"), 120_000);
    });
  }

  /**
   * Excel + un seul ZIP protégé (pas de dossier / ZIP ouvert).
   */
  async function handleDownloadAll(password: string) {
    if (!exportParams || !results?.length) return;
    // Doit rester dans le clic : Chrome bloque window.open après un await.
    const popup = window.open("about:blank", "portail_rh_zip_dl");
    if (!popup) {
      toast.error("Pop-up bloquée", {
        description: "Autorisez les pop-ups pour localhost, puis réessayez.",
      });
      return;
    }
    setExportLoading(true);
    const stamp = new Date().toISOString().slice(0, 10);
    const zipName = `export-documents-${stamp}.zip`;

    try {
      const excelResponse = await fetch(`/api/search/documents/export?${exportParams}`);
      if (!excelResponse.ok) {
        const data = await excelResponse.json().catch(() => null);
        popup.close();
        toast.error("Export Excel impossible", {
          description: data?.error ?? `Erreur HTTP ${excelResponse.status}`,
        });
        return;
      }
      triggerBlobDownload(await excelResponse.blob(), `export-documents-${stamp}.xlsx`);
      toast.success("Excel enregistré");

      toast.message("ZIP protégé en cours…", {
        description: "Seul le fichier avec mot de passe sera enregistré.",
      });

      const prepareResponse = await fetch(
        `/api/search/documents/export-zip-prepare?${exportParams}`,
      );
      const prepareData = await prepareResponse.json().catch(() => null);
      if (!prepareResponse.ok || !prepareData?.url || !prepareData?.envelope) {
        popup.close();
        toast.error("ZIP impossible", {
          description: prepareData?.error ?? "Préparation impossible.",
        });
        return;
      }

      setZipPasswordOpen(false);
      const result = await receiveProtectedZip(
        popup,
        prepareData.url as string,
        prepareData.envelope as string,
        password,
        zipName,
      );

      if (result === "ok") {
        toast.success("ZIP protégé enregistré", {
          description: `${zipName} — mot de passe requis (7-Zip).`,
        });
        return;
      }
      if (result === "old-script") {
        toast.error("ZIP ouvert encore téléchargé par Google", {
          description:
            "La Web App en ligne est l’ancienne version. Dans Apps Script : Déployer → Gérer les déploiements → Modifier → Nouvelle version, avec le fichier scripts/apps-script/ZIP-WEBAPP-COLLER.gs.",
        });
        return;
      }
      toast.error("ZIP protégé non reçu", {
        description:
          "La page Google doit envoyer le ZIP au Portail. Republiez la Web App (ZIP-WEBAPP-COLLER.gs), compte Veolia connecté.",
      });
    } catch {
      try {
        popup.close();
      } catch {
        // ignore
      }
      toast.error("Téléchargement impossible");
    } finally {
      setExportLoading(false);
    }
  }

  const documentTypeOptions = useMemo(() => {
    const selected = state.category.length > 0 ? new Set(state.category) : null;
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const entry of allowedDocumentTypes) {
      if (selected && !selected.has(entry.category)) continue;
      if (seen.has(entry.value)) continue;
      seen.add(entry.value);
      opts.push({ value: entry.value, label: entry.label });
    }
    return opts;
  }, [state.category, allowedDocumentTypes]);

  function optionList(key: string) {
    return (filterOptions[key] ?? []).map((v) => ({ value: v, label: v }));
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="mb-2 block h-0.5 w-8 rounded-full bg-primary" aria-hidden />
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            Requête
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {userName} · {roleLabels[userRole]}. Cliquez un champ pour filtrer, ou glissez-le vers Excel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs shadow-elevation-xs">
            <span className="font-semibold tabular-nums text-foreground">{exportColumns.length}</span>
            <span className="text-muted-foreground">colonnes</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs shadow-elevation-xs">
            <span className="font-semibold tabular-nums text-foreground">{activeFields.length}</span>
            <span className="text-muted-foreground">filtres</span>
          </span>
          <Button
            onClick={handleLaunch}
            disabled={launching}
            className="h-10 rounded-full px-5"
          >
            {launching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Lancer la requête
          </Button>
        </div>
      </header>

      <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-elevation-md">
        <div className="grid items-stretch lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="relative border-b border-border/70 lg:border-r lg:border-b-0">
          <aside className="flex max-h-80 flex-col overflow-hidden bg-card lg:absolute lg:inset-0 lg:max-h-none">
              <div className="shrink-0 space-y-2 border-b border-border/70 px-3 py-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">Bibliothèque</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Un clic filtre. Un glisser ajoute une colonne.
                  </p>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={libraryQuery}
                    onChange={(e) => setLibraryQuery(e.target.value)}
                    placeholder="Chercher un champ…"
                    className="h-8 bg-card pl-8"
                    aria-label="Rechercher un champ dans la bibliothèque"
                  />
                </div>
              </div>
              <div
                ref={libraryScrollRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-2 [overflow-anchor:none]"
              >
              {availableByGroup.size === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                  Aucun champ pour « {libraryQuery.trim()} ».
                </p>
              ) : (
              [...availableByGroup.entries()].map(([group, fields]) => (
                <div key={group}>
                  <p className="sticky top-0 z-10 -mx-3 mb-1.5 flex items-center gap-2 bg-card px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    <span
                      className={cn("size-1.5 rounded-full", GROUP_ACCENT[group] ?? "bg-primary")}
                      aria-hidden
                    />
                    {group}
                  </p>
                  <ul className="space-y-1">
                    {fields.map((field) => {
                      const inFilter = activeFields.includes(field.id);
                      const inExcel =
                        isExportColumnId(field.id) && exportColumns.includes(field.id);
                      return (
                        <li key={field.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onPointerDown={(e) => onFieldPointerDown(e, field)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                addField(field.id);
                              }
                            }}
                            className={cn(
                              "group/field flex w-full select-none items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-left text-sm transition-all",
                              "cursor-grab touch-none hover:border-primary/25 hover:bg-accent hover:shadow-elevation-xs active:cursor-grabbing",
                              draggingId === field.id && "border-primary/40 bg-accent opacity-40",
                              (inFilter || inExcel) && "border-primary/15 bg-accent/60",
                            )}
                          >
                            <GripVertical className="size-3.5 shrink-0 text-primary/40 transition-colors group-hover/field:text-primary" />
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                GROUP_ACCENT[field.group] ?? "bg-primary",
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 truncate">{field.label}</span>
                            <span className="ml-auto flex shrink-0 gap-0.5">
                              {inFilter && (
                                <Badge className="border-0 bg-[oklch(0.95_0.03_82)] px-1 py-0 text-[9px] text-gold-ink">
                                  Filtre
                                </Badge>
                              )}
                              {inExcel && (
                                <Badge className="border-0 bg-accent px-1 py-0 text-[9px] text-primary">
                                  Excel
                                </Badge>
                              )}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
              )}
              </div>
            </aside>
          </div>

            <div className="flex min-h-[40rem] flex-col">
            <div
              ref={dropExportRef}
              className={cn(
                "shrink-0 border-b border-border/70 bg-muted/40 px-4 py-3 transition-colors",
                dropHover === "export" && "bg-accent",
              )}
            >
              <div className="flex shrink-0 items-start justify-between gap-2">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
                    <Columns3 className="size-3.5" />
                    Colonnes du fichier
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    L’ordre des pastilles est l’ordre des colonnes Excel.
                  </p>
                </div>
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-primary/25 text-[10px] font-medium text-primary">
                  {exportColumns.length}
                </span>
              </div>
              <div
                className={cn(
                  "mt-2 flex h-11 w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-dashed px-3 transition-colors",
                  dropHover === "export"
                    ? "border-primary bg-card ring-2 ring-ring/40"
                    : "border-border bg-card/80",
                  draggingId && dropHover !== "export" && "border-primary/40",
                )}
              >
                {exportColumns.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Plus className="size-4 shrink-0 text-primary/70" />
                    {draggingId
                      ? dropHover === "export"
                        ? "Relâchez pour créer la colonne"
                        : "Déposez un champ dans ce cadre"
                      : "Glissez un champ ici — Nom, Matricule, CIN…"}
                  </p>
                ) : (
                  exportColumns.map((id) => {
                    const label =
                      fieldById[id as QueryFieldId]?.label ?? getExportColumnHeader(id);
                    return (
                      <Badge
                        key={id}
                        className="h-7 gap-1.5 border-0 bg-primary py-1 pr-1 pl-2.5 text-xs font-medium text-primary-foreground shadow-sm"
                      >
                        {label}
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-white/80 hover:bg-white/20 hover:text-white"
                          onClick={() => removeExportColumn(id)}
                          aria-label={`Retirer colonne ${label}`}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    );
                  })
                )}
              </div>
            </div>

            <div
          ref={dropParamsRef}
          className={cn(
            "relative flex min-h-[32rem] flex-col bg-card px-4 py-3 transition-colors [background-image:radial-gradient(circle,oklch(0.72_0.04_285/0.45)_1px,transparent_1px)] [background-size:18px_18px] sm:px-5 lg:min-h-[calc(100dvh-20rem)]",
            dropHover === "filter" && "bg-accent/60",
          )}
        >
          <div className="shrink-0">
            <h2 className="text-sm font-semibold tracking-tight">Filtres actifs</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeFields.length === 0
                ? "Aucun critère. La recherche portera sur tous les dossiers."
                : "Remplissez chaque carte, puis lancez la requête."}
            </p>
          </div>
          {activeFields.length === 0 ? (
            <QueryCanvasEmpty dragging={Boolean(draggingId)} />
          ) : (
            <div className="mt-3 grid w-full content-start gap-3">
              {activeFields.map((id) => (
                <QueryFieldControl
                  key={id}
                  id={id}
                  label={fieldById[id].label}
                  state={state}
                  patch={patch}
                  optionList={optionList}
                  documentTypeOptions={documentTypeOptions}
                  allowedCategories={allowedCategories}
                  onRemove={() => removeField(id)}
                />
              ))}
            </div>
          )}
        </div>
          </div>
        </div>
      </section>

      {ghost && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-elevation-md"
          style={{ left: ghost.x + 12, top: ghost.y + 12 }}
        >
          <GripVertical className="size-3.5 text-muted-foreground/60" />
          {ghost.label}
        </div>
      )}

      <ZipPasswordDialog
        open={zipPasswordOpen}
        onOpenChange={setZipPasswordOpen}
        onConfirm={handleDownloadAll}
        loading={exportLoading}
      />

      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4 pr-12">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle>Résultats de la requête</DialogTitle>
                <DialogDescription>
                  {launching
                    ? "Recherche en cours…"
                    : resultsError
                      ? resultsError
                      : `${results?.length ?? 0} document${(results?.length ?? 0) !== 1 ? "s" : ""} trouvé${(results?.length ?? 0) !== 1 ? "s" : ""}`}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <a
                  href={exportParams ? `/api/search/documents/export?${exportParams}` : "#"}
                  download
                  aria-disabled={!exportParams || launching || exportLoading}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5",
                    (!exportParams || launching || exportLoading) && "pointer-events-none opacity-50",
                  )}
                >
                  <Download className="size-3.5" />
                  Excel seul
                </a>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!exportParams || launching || exportLoading || !results?.length}
                  onClick={() => setZipPasswordOpen(true)}
                  title="Télécharge l'Excel puis un ZIP des fichiers Drive protégé par mot de passe"
                >
                  {exportLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Lock className="size-3.5" />
                  )}
                  Excel + fichiers
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto">
            {launching && results === null ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : resultsError ? (
              <div className="flex flex-col items-center py-14 text-center">
                <FileText className="size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-medium">Requête impossible</p>
                <p className="mt-1 text-xs text-muted-foreground">{resultsError}</p>
              </div>
            ) : results && results.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <FileText className="size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-medium">Aucun résultat</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Modifiez les critères puis relancez la requête.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 text-xs">Salarié</TableHead>
                    <TableHead className="h-8 text-xs">Document</TableHead>
                    <TableHead className="h-8 text-xs">Cat.</TableHead>
                    <TableHead className="hidden h-8 text-xs md:table-cell">Modifié</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results?.map((doc) => (
                    <QueryResultRow key={doc.id} doc={doc} />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QueryCanvasEmpty({ dragging }: { dragging: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 py-8 text-center">
      <div className="relative mb-2 grid size-14 shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-full bg-accent blur-md" />
        <span className="absolute inset-1.5 rounded-full border border-dashed border-primary/40" />
        <span className="relative grid size-9 place-items-center rounded-xl bg-card shadow-elevation-md">
          <FileText className="size-4 text-primary" />
        </span>
      </div>
      <p className="text-sm font-semibold tracking-tight">
        {dragging ? "Relâchez pour ajouter le filtre" : "Déposez vos critères ici"}
      </p>
      <p className="mt-0.5 max-w-md text-xs text-muted-foreground">
        {dragging
          ? "Ce cadre limite la recherche. Le cadre du haut construit le fichier Excel."
          : "Les cartes de filtre apparaîtront sur cette grille."}
      </p>
      {!dragging && (
        <div className="mt-3 grid w-full max-w-lg shrink-0 gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-card px-3 py-2 text-left shadow-elevation-xs">
            <MousePointerClick className="size-3.5 text-gold-ink" />
            <p className="mt-1 text-sm font-medium">Clic = filtre</p>
            <p className="text-xs text-muted-foreground">Le champ s’ouvre ici, prêt à remplir.</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card px-3 py-2 text-left shadow-elevation-xs">
            <Columns3 className="size-3.5 text-primary" />
            <p className="mt-1 text-sm font-medium">Glisser = colonne</p>
            <p className="text-xs text-muted-foreground">Le champ rejoint les colonnes, en haut.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatResultDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function QueryResultRow({ doc }: { doc: DocumentResult }) {
  const router = useRouter();
  const denied = !doc.authorized;
  const dossierHref = `/dashboard/employees/${encodeURIComponent(doc.employee.matricule)}`;

  return (
    <TableRow
      className={cn(!denied && "cursor-pointer", denied && "opacity-55")}
      onClick={() => {
        if (!denied) router.push(dossierHref);
      }}
    >
      <TableCell className="py-2">
        <Link
          href={dossierHref}
          className={cn("flex items-center gap-2.5", denied && "pointer-events-none")}
          onClick={(event) => event.stopPropagation()}
        >
          <EmployeeAvatar name={doc.employee.displayName} size="xs" />
          <span className="min-w-0">
            <span
              className={cn(
                "block text-sm font-medium hover:underline",
                denied && "text-muted-foreground no-underline",
              )}
            >
              {doc.employee.displayName}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {doc.employee.matricule}
            </span>
          </span>
        </Link>
      </TableCell>
      <TableCell className="max-w-[200px] py-2">
        <span className={cn("truncate text-sm", denied && "text-muted-foreground")}>
          {doc.fileName}
        </span>
      </TableCell>
      <TableCell className="py-2">
        <Badge variant="outline" className="text-[10px]">
          {categoryFilterLabels[doc.category]}
        </Badge>
      </TableCell>
      <TableCell className="hidden py-2 text-xs text-muted-foreground md:table-cell">
        {formatResultDate(doc.modifiedAt)}
      </TableCell>
    </TableRow>
  );
}

function QueryFieldControl({
  id,
  label,
  state,
  patch,
  optionList,
  documentTypeOptions,
  allowedCategories,
  onRemove,
}: {
  id: QueryFieldId;
  label: string;
  state: FiltersState;
  patch: (partial: Partial<FiltersState>) => void;
  optionList: (key: string) => { value: string; label: string }[];
  documentTypeOptions: { value: string; label: string }[];
  allowedCategories: DocumentCategory[];
  onRemove: () => void;
}) {
  if (EXPORT_ONLY_FIELDS.has(id)) {
    return (
      <div className="flex w-full items-start gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          « {label} » est une colonne Excel uniquement — déposez-la dans Export Excel.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Supprimer ${label}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full items-end gap-1.5 rounded-2xl border border-border/80 bg-card p-3 shadow-elevation-xs">
      <FilterField label={label} className="min-w-0 flex-1">
        {renderControl(id, state, patch, optionList, documentTypeOptions, allowedCategories)}
      </FilterField>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="mb-0.5 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label={`Supprimer le filtre ${label}`}
        title="Supprimer ce filtre"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function renderControl(
  id: QueryFieldId,
  state: FiltersState,
  patch: (partial: Partial<FiltersState>) => void,
  optionList: (key: string) => { value: string; label: string }[],
  documentTypeOptions: { value: string; label: string }[],
  allowedCategories: DocumentCategory[],
) {
  switch (id) {
    case "query":
      return (
        <Input
          className="h-8"
          placeholder="AB123456, El Amrani, Casa Centre…"
          value={state.query}
          onChange={(e) => patch({ query: e.target.value })}
        />
      );
    case "genre":
      return (
        <FilterSelect
          value={state.genre}
          onValueChange={(v) => patch({ genre: v as FiltersState["genre"] })}
          placeholder="Tous genres"
          options={[
            { value: "ALL", label: "Tous genres" },
            { value: "H", label: "Hommes" },
            { value: "F", label: "Femmes" },
          ]}
        />
      );
    case "matricule":
      return (
        <Input
          className="h-8"
          placeholder="Ex. 100002"
          value={state.matricule}
          onChange={(e) => patch({ matricule: e.target.value })}
        />
      );
    case "nom":
      return (
        <Input
          className="h-8"
          placeholder="Ex. Bennani"
          value={state.nom}
          onChange={(e) => patch({ nom: e.target.value })}
        />
      );
    case "prenom":
      return (
        <Input
          className="h-8"
          placeholder="Ex. Sara"
          value={state.prenom}
          onChange={(e) => patch({ prenom: e.target.value })}
        />
      );
    case "cin":
      return (
        <Input
          className="h-8"
          placeholder="Ex. AB123456"
          value={state.cin}
          onChange={(e) => patch({ cin: e.target.value })}
        />
      );
    case "ageRange":
      return (
        <FilterSelect
          value={state.ageRange}
          onValueChange={(v) => patch({ ageRange: v })}
          placeholder="Tous âges"
          options={[
            { value: "ALL", label: "Tous âges" },
            { value: "-29", label: "Moins de 30 ans" },
            { value: "30-39", label: "30 à 39 ans" },
            { value: "40-49", label: "40 à 49 ans" },
            { value: "50-", label: "50 ans et plus" },
          ]}
        />
      );
    case "minChildren":
      return (
        <FilterSelect
          value={state.minChildren}
          onValueChange={(v) => patch({ minChildren: v })}
          placeholder="Tous"
          options={[
            { value: "0", label: "Tous" },
            { value: "1", label: "1 enfant ou plus" },
            { value: "2", label: "2 enfants ou plus" },
            { value: "3", label: "3 enfants ou plus" },
            { value: "4", label: "4 enfants ou plus" },
          ]}
        />
      );
    case "childrenExact":
      return (
        <MultiFilterSelect
          value={state.childrenExact}
          onValueChange={(v) => patch({ childrenExact: v })}
          placeholder="Tous"
          options={[
            { value: "0", label: "0 enfant" },
            { value: "1", label: "1 enfant" },
            { value: "2", label: "2 enfants" },
            { value: "3", label: "3 enfants" },
            { value: "4", label: "4 enfants ou plus" },
          ]}
        />
      );
    case "hasSpouseDocument":
      return (
        <FilterSelect
          value={state.hasSpouseDocument}
          onValueChange={(v) =>
            patch({ hasSpouseDocument: v as FiltersState["hasSpouseDocument"] })
          }
          placeholder="Indifférent"
          options={[
            { value: "ALL", label: "Indifférent" },
            { value: "OUI", label: "Oui" },
            { value: "NON", label: "Non" },
          ]}
        />
      );
    case "childName":
      return (
        <Input
          className="h-8"
          placeholder="Prénom"
          value={state.childName}
          onChange={(e) => patch({ childName: e.target.value })}
        />
      );
    case "managerMatricule":
      return (
        <Input
          className="h-8"
          placeholder="Matricule"
          value={state.managerMatricule}
          onChange={(e) => patch({ managerMatricule: e.target.value })}
        />
      );
    case "direction":
    case "service":
    case "entite":
    case "sousEntite":
    case "zone":
    case "agence":
    case "statut":
    case "college":
    case "admTech":
    case "position":
    case "categorieRh":
    case "niveau":
    case "grade":
    case "situation":
    case "folderName":
      return (
        <MultiFilterSelect
          value={state[id] as string[]}
          onValueChange={(v) => patch({ [id]: v } as Partial<FiltersState>)}
          placeholder="Tous"
          options={optionList(id)}
        />
      );
    case "poste":
      return (
        <Input
          className="h-8"
          placeholder="Poste"
          value={state.poste}
          onChange={(e) => patch({ poste: e.target.value })}
        />
      );
    case "encadrant":
      return (
        <FilterSelect
          value={state.encadrant}
          onValueChange={(v) => patch({ encadrant: v as FiltersState["encadrant"] })}
          placeholder="Indifférent"
          options={[
            { value: "ALL", label: "Indifférent" },
            { value: "OUI", label: "Oui" },
            { value: "NON", label: "Non" },
          ]}
        />
      );
    case "ancienneteRange":
      return (
        <FilterSelect
          value={state.ancienneteRange}
          onValueChange={(v) => patch({ ancienneteRange: v })}
          placeholder="Toute ancienneté"
          options={[
            { value: "ALL", label: "Toute ancienneté" },
            { value: "-4", label: "Moins de 5 ans" },
            { value: "5-9", label: "5 à 9 ans" },
            { value: "10-19", label: "10 à 19 ans" },
            { value: "20-", label: "20 ans et plus" },
          ]}
        />
      );
    case "dateEntree":
      return (
        <DateRangeFilterControl
          mode={state.dateEntreeMode}
          from={state.dateEntreeFrom}
          to={state.dateEntreeTo}
          onModeChange={(dateEntreeMode) => patch({ dateEntreeMode, dateEntreeTo: "" })}
          onFromChange={(dateEntreeFrom) => patch({ dateEntreeFrom })}
          onToChange={(dateEntreeTo) => patch({ dateEntreeTo })}
        />
      );
    case "dateDepart":
      return (
        <DateRangeFilterControl
          mode={state.dateDepartMode}
          from={state.dateDepartFrom}
          to={state.dateDepartTo}
          onModeChange={(dateDepartMode) => patch({ dateDepartMode, dateDepartTo: "" })}
          onFromChange={(dateDepartFrom) => patch({ dateDepartFrom })}
          onToChange={(dateDepartTo) => patch({ dateDepartTo })}
        />
      );
    case "modifiedDate":
      return (
        <DateRangeFilterControl
          mode={state.modifiedMode}
          from={state.modifiedFrom}
          to={state.modifiedTo}
          onModeChange={(modifiedMode) => patch({ modifiedMode, modifiedTo: "" })}
          onFromChange={(modifiedFrom) => patch({ modifiedFrom })}
          onToChange={(modifiedTo) => patch({ modifiedTo })}
        />
      );
    case "category":
      return (
        <MultiFilterSelect
          value={state.category}
          onValueChange={(v) => patch({ category: v as DocumentCategory[] })}
          placeholder="Toutes"
          options={allowedCategories.map((cat) => ({
            value: cat,
            label: categoryFilterLabels[cat],
          }))}
        />
      );
    case "documentTypes":
      return (
        <MultiFilterSelect
          value={state.documentTypes}
          onValueChange={(v) => patch({ documentTypes: v })}
          placeholder="Tous"
          options={documentTypeOptions}
        />
      );
    case "documentType":
      return (
        <Input
          className="h-8"
          placeholder="Texte libre"
          value={state.documentType}
          onChange={(e) => patch({ documentType: e.target.value })}
        />
      );
    default:
      return null;
  }
}
