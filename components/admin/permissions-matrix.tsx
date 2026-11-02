"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  allCategories,
  categoryLabels,
  categoryShort,
  type DocumentCategory,
} from "@/lib/document-category";
import type {
  CategoryAccessMap,
  DocumentTypeCatalogMap,
  PermissionRoleRow,
  PermissionUserRow,
  ResolvedAccess,
} from "@/lib/permissions/types";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  RH_MANAGER: "Resp. RH",
  RH_AGENT: "Agent",
};

type PermissionsResponse = {
  users: PermissionUserRow[];
  roles: PermissionRoleRow[];
  documentTypesByCategory: DocumentTypeCatalogMap;
};

/** Counts explicit document-type overrides across every category for a resolved access. */
function overrideCount(access: ResolvedAccess): number {
  return Object.values(access.documentTypes).reduce(
    (sum, overrides) => sum + Object.keys(overrides ?? {}).length,
    0,
  );
}

export function PermissionsMatrix() {
  const [users, setUsers] = useState<PermissionUserRow[]>([]);
  const [roles, setRoles] = useState<PermissionRoleRow[]>([]);
  const [documentTypesByCategory, setDocumentTypesByCategory] = useState<DocumentTypeCatalogMap>({});
  const [directionOptions, setDirectionOptions] = useState<string[]>([]);
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/search/filter-options");
        if (!res.ok) return;
        const data = (await res.json()) as {
          options: { direction?: string[]; service?: string[] };
        };
        setDirectionOptions(data.options.direction ?? []);
        setServiceOptions(data.options.service ?? []);
      } catch {
        // Non-critical — scope popover falls back to "no options available".
      }
    })();
  }, []);

  const applyResponse = useCallback((data: PermissionsResponse) => {
    setUsers(data.users);
    setRoles(data.roles);
    setDocumentTypesByCategory(data.documentTypesByCategory);
  }, []);

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/permissions");
      if (!res.ok) throw new Error("load_failed");
      applyResponse((await res.json()) as PermissionsResponse);
    } catch {
      toast.error("Impossible de charger les permissions.");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadPermissions();
    }, 0);
    return () => clearTimeout(id);
  }, [loadPermissions]);

  async function patchPermissions(body: object): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "save_failed");
      }
      applyResponse((await res.json()) as PermissionsResponse);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ── User-level actions ──────────────────────────────────────────────────
  async function setUserCategory(
    userId: string,
    category: DocumentCategory,
    documentType: string,
    canView: boolean,
  ) {
    const ok = await patchPermissions({ type: "single", userId, category, documentType, canView });
    if (ok) toast.success("Droit mis à jour.");
  }

  async function resetUserDocumentType(userId: string, category: DocumentCategory, documentType: string) {
    // "Reset" = re-derive the role baseline and re-apply it as this user's value,
    // which is the closest equivalent to "remove override" the current API supports
    // without a dedicated delete endpoint — functionally identical from the user's
    // perspective (the cell goes back to matching the role baseline).
    const role = users.find((u) => u.id === userId)?.role;
    const roleRow = roles.find((r) => r.role === role);
    const baseline =
      roleRow?.access.documentTypes[category]?.[documentType] ?? roleRow?.access.category[category] ?? true;
    await setUserCategory(userId, category, documentType, baseline);
  }

  async function setRowAll(user: PermissionUserRow, canView: boolean) {
    if (user.role === "ADMIN") return;
    const access = Object.fromEntries(allCategories.map((c) => [c, canView])) as CategoryAccessMap;
    const ok = await patchPermissions({ type: "user", userId: user.id, access });
    if (ok) {
      toast.success(canView ? "Tous les dossiers autorisés" : "Tous les dossiers refusés", {
        description: user.name,
      });
    }
  }

  async function setColumnAll(category: DocumentCategory, canView: boolean) {
    const ok = await patchPermissions({ type: "column", category, documentType: "*", canView });
    if (ok) {
      toast.success(
        canView
          ? `« ${categoryLabels[category]} » autorisé pour tous`
          : `« ${categoryLabels[category]} » refusé pour tous`,
      );
    }
  }

  // ── Role-level actions ───────────────────────────────────────────────────
  async function setRoleCategory(
    role: Role,
    category: DocumentCategory,
    documentType: string,
    canView: boolean,
  ) {
    if (role === "ADMIN") return;
    const ok = await patchPermissions({ type: "role", role, category, documentType, canView });
    if (ok) toast.success("Rôle mis à jour.");
  }

  async function setEmployeeScope(
    userId: string,
    allowedDirections: string[],
    allowedServices: string[],
  ) {
    const ok = await patchPermissions({
      type: "employeeScope",
      userId,
      allowedDirections,
      allowedServices,
    });
    if (ok) toast.success("Périmètre mis à jour.");
  }

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        roleLabels[u.role].toLowerCase().includes(q),
    );
  }, [users, query]);

  const editableCount = users.filter((u) => u.role !== "ADMIN").length;

  if (loading) {
    return (
      <div className="space-y-4">
        <Panel>
          <Skeleton className="h-4 w-56" />
        </Panel>
        <Panel padding="none" className="overflow-hidden">
          <div className="border-b border-border/70 px-3 py-2.5 sm:px-4">
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Panel padding="none" className="overflow-hidden">
        <PanelHeader
          className="border-b border-border/70 px-3 py-2.5 sm:px-4"
          title="Rôles — accès de référence"
          description="Base appliquée à tout utilisateur du rôle, sauf exception ci-dessous. Cliquez le chevron d'une catégorie pour affiner par type de document."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-xs">
                <th className="sticky left-0 z-10 min-w-[160px] bg-muted/30 px-3 py-2 text-left font-medium">
                  Rôle
                </th>
                {allCategories.map((cat) => (
                  <th key={cat} className="px-2 py-2 text-center font-medium">
                    <span title={categoryLabels[cat]}>{categoryShort[cat]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((row) => {
                const isAdmin = row.role === "ADMIN";
                return (
                  <tr key={row.role} className="border-b border-border/60 last:border-0">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{roleLabels[row.role]}</span>
                        {isAdmin && (
                          <Badge variant="outline" className="text-[10px]">
                            Toujours complet
                          </Badge>
                        )}
                      </div>
                    </td>
                    {allCategories.map((cat) => (
                      <td key={cat} className="px-2 py-2 text-center">
                        <PermissionCell
                          category={cat}
                          access={row.access}
                          documentTypes={documentTypesByCategory[cat] ?? []}
                          disabled={isAdmin || saving}
                          ariaLabel={`${roleLabels[row.role]} — ${categoryLabels[cat]}`}
                          onSetCategory={(v) => void setRoleCategory(row.role, cat, "*", v)}
                          onSetDocumentType={(type, v) => void setRoleCategory(row.role, cat, type, v)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div>
            <PanelHeader
              className="mb-0"
              title="Utilisateurs — exceptions individuelles"
              description={`${editableCount} utilisateur${editableCount > 1 ? "s" : ""} · hérite du rôle sauf override explicite${saving ? " · enregistrement…" : ""}`}
            />
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7 text-sm"
              placeholder="Filtrer utilisateurs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-xs">
                <th className="sticky left-0 z-10 min-w-[200px] bg-muted/30 px-3 py-2 text-left font-medium">
                  Utilisateur
                </th>
                {allCategories.map((cat) => (
                  <th key={cat} className="px-2 py-2 text-center font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <span title={categoryLabels[cat]}>{categoryShort[cat]}</span>
                      <div className="flex gap-0.5">
                        <ColumnAction
                          label="+"
                          title={`Autoriser ${categoryLabels[cat]} pour tous`}
                          disabled={saving}
                          onClick={() => void setColumnAll(cat, true)}
                        />
                        <ColumnAction
                          label="−"
                          title={`Refuser ${categoryLabels[cat]} pour tous`}
                          disabled={saving}
                          onClick={() => void setColumnAll(cat, false)}
                        />
                      </div>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Périmètre</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Ligne</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isAdmin = user.role === "ADMIN";
                const activeCount = allCategories.filter((c) => user.access.category[c]).length;
                const overrides = overrideCount(user.access);

                return (
                  <tr
                    key={user.id}
                    className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/25"
                  >
                    <td className="sticky left-0 z-10 bg-card px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{user.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {roleLabels[user.role]}
                        </Badge>
                      </div>
                      {!isAdmin && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {activeCount}/{allCategories.length} dossiers
                          {overrides > 0 ? ` · ${overrides} exception${overrides > 1 ? "s" : ""}` : ""}
                        </p>
                      )}
                    </td>
                    {allCategories.map((cat) => (
                      <td key={cat} className="px-2 py-2 text-center">
                        <PermissionCell
                          category={cat}
                          access={user.access}
                          documentTypes={documentTypesByCategory[cat] ?? []}
                          disabled={isAdmin || saving}
                          ariaLabel={`${user.name} — ${categoryLabels[cat]}`}
                          onSetCategory={(v) => void setUserCategory(user.id, cat, "*", v)}
                          onSetDocumentType={(type, v) => void setUserCategory(user.id, cat, type, v)}
                          onResetDocumentType={(type) => void resetUserDocumentType(user.id, cat, type)}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center">
                      {isAdmin ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <EmployeeScopeCell
                          user={user}
                          directionOptions={directionOptions}
                          serviceOptions={serviceOptions}
                          disabled={saving}
                          onSave={setEmployeeScope}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin ? (
                        <span className="text-xs text-muted-foreground">Tout</span>
                      ) : (
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={saving}
                            onClick={() => void setRowAll(user, true)}
                          >
                            Tout
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={saving}
                            onClick={() => void setRowAll(user, false)}
                          >
                            Aucun
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {users.length === 0
              ? "Aucun utilisateur actif. Créez des comptes dans Utilisateurs."
              : "Aucun utilisateur ne correspond au filtre."}
          </p>
        )}
      </Panel>
    </div>
  );
}

/**
 * One category cell: a switch for the category-wide value, plus (only when the
 * category has a known document-type catalog) a chevron opening a popover with
 * per-type switches — each defaults to inheriting the category value and shows a
 * reset action once explicitly overridden.
 */
function PermissionCell({
  category,
  access,
  documentTypes,
  disabled,
  ariaLabel,
  onSetCategory,
  onSetDocumentType,
  onResetDocumentType,
}: {
  category: DocumentCategory;
  access: ResolvedAccess;
  documentTypes: { key: string; label: string }[];
  disabled: boolean;
  ariaLabel: string;
  onSetCategory: (canView: boolean) => void;
  onSetDocumentType: (documentType: string, canView: boolean) => void;
  onResetDocumentType?: (documentType: string) => void;
}) {
  const categoryValue = access.category[category] === true;
  const overrides = access.documentTypes[category] ?? {};
  const overrideCountForCategory = Object.keys(overrides).length;

  return (
    <div className="flex items-center justify-center gap-1">
      <Switch
        checked={categoryValue}
        disabled={disabled}
        onCheckedChange={onSetCategory}
        aria-label={ariaLabel}
      />
      {documentTypes.length > 0 && (
        <Popover>
          <PopoverTrigger
            disabled={disabled}
            className={cn(
              "relative flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
            )}
            title={`Détail par type de document — ${categoryLabels[category]}`}
          >
            <ChevronDown className="size-3.5" />
            {overrideCountForCategory > 0 && (
              <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                {overrideCountForCategory}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="center">
            <p className="mb-2 text-xs font-medium text-foreground">{categoryLabels[category]}</p>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {documentTypes.map((type) => {
                const override = overrides[type.key];
                const resolved = override ?? categoryValue;
                const isOverridden = override !== undefined;
                return (
                  <div key={type.key} className="flex items-center justify-between gap-3 py-1">
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-xs",
                        isOverridden ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                      title={type.label}
                    >
                      {type.label}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isOverridden && onResetDocumentType && (
                        <button
                          type="button"
                          title="Revenir à la valeur du rôle"
                          disabled={disabled}
                          onClick={() => onResetDocumentType(type.key)}
                          className="flex size-4 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                        >
                          <RotateCcw className="size-3" />
                        </button>
                      )}
                      <Switch
                        checked={resolved}
                        disabled={disabled}
                        onCheckedChange={(v) => onSetDocumentType(type.key, v)}
                        aria-label={`${ariaLabel} — ${type.label}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/**
 * Per-user popover for scoping which directions/services a user can see at all —
 * layered beneath the category/document-type matrix above (a denied category still
 * wins for an in-scope employee). Empty selection = unrestricted.
 */
function EmployeeScopeCell({
  user,
  directionOptions,
  serviceOptions,
  disabled,
  onSave,
}: {
  user: PermissionUserRow;
  directionOptions: string[];
  serviceOptions: string[];
  disabled: boolean;
  onSave: (userId: string, allowedDirections: string[], allowedServices: string[]) => void;
}) {
  const scope = user.access.employeeScope;
  const [directions, setDirections] = useState(scope.allowedDirections);
  const [services, setServices] = useState(scope.allowedServices);
  const restricted = scope.allowedDirections.length > 0 || scope.allowedServices.length > 0;

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          setDirections(scope.allowedDirections);
          setServices(scope.allowedServices);
        }
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-muted disabled:opacity-40",
          restricted ? "text-foreground" : "text-muted-foreground",
        )}
        title="Limiter les salariés visibles (direction/service)"
      >
        {restricted ? `${scope.allowedDirections.length + scope.allowedServices.length} filtre(s)` : "Tous"}
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64">
        <p className="mb-2 text-xs font-medium text-foreground">Périmètre — {user.name}</p>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Aucune sélection = tous les salariés visibles.
        </p>
        <div className="max-h-56 space-y-3 overflow-y-auto">
          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Directions
            </p>
            <div className="space-y-1">
              {directionOptions.length === 0 && (
                <p className="text-[11px] text-muted-foreground">Aucune donnée.</p>
              )}
              {directionOptions.map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={directions.includes(d)}
                    onChange={() => toggle(directions, setDirections, d)}
                  />
                  <span className="truncate" title={d}>{d}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Services
            </p>
            <div className="space-y-1">
              {serviceOptions.length === 0 && (
                <p className="text-[11px] text-muted-foreground">Aucune donnée.</p>
              )}
              {serviceOptions.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={services.includes(s)}
                    onChange={() => toggle(services, setServices, s)}
                  />
                  <span className="truncate" title={s}>{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            size="xs"
            disabled={disabled}
            onClick={() => onSave(user.id, directions, services)}
          >
            Enregistrer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColumnAction({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-4 items-center justify-center rounded text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
      )}
    >
      {label}
    </button>
  );
}

/** @deprecated Use PermissionsMatrix */
export function PermissionsMatrixPreview() {
  return <PermissionsMatrix />;
}
