"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createUserSchema } from "@/lib/validations/user";
import { passwordSchema } from "@/lib/validations/password";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "RH_MANAGER" | "RH_AGENT";
  isActive: boolean;
  passwordOrigin: "ADMIN" | "FORGOT_PASSWORD" | "USER";
  canViewPassword: boolean;
  viewablePassword: string | null;
  lastLoginAt: string | null;
};

function formatLastLogin(iso: string | null) {
  if (!iso) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const createFormSchema = createUserSchema;
type CreateForm = z.infer<typeof createFormSchema>;

const roleLabels: Record<AdminUser["role"], string> = {
  ADMIN: "Administrateur",
  RH_MANAGER: "Responsable RH",
  RH_AGENT: "Agent RH",
};

const originLabels: Record<AdminUser["passwordOrigin"], string> = {
  ADMIN: "Défini par admin",
  FORGOT_PASSWORD: "Réinit. email",
  USER: "Modifié par l'utilisateur",
};

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const form = useForm<CreateForm>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      role: "RH_AGENT",
    },
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users);
    } catch {
      toast.error("Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(loadUsers, 0);
    return () => clearTimeout(id);
  }, [loadUsers]);

  async function onCreate(values: CreateForm) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success("Utilisateur créé");
      form.reset({ role: "RH_AGENT" });
      setDialogOpen(false);
      loadUsers();
    } catch {
      toast.error("Une erreur est survenue.");
    }
  }

  async function toggleActive(user: AdminUser) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success(user.isActive ? "Compte désactivé" : "Compte activé");
      loadUsers();
    } catch {
      toast.error("Une erreur est survenue.");
    }
  }

  return (
    <Panel padding="none">
      <PanelHeader
        className="flex-col items-start gap-3 border-b border-border/70 px-3 py-2.5 sm:flex-row sm:items-center sm:px-4"
        title="Utilisateurs"
        description="Créez des comptes RH. Le mot de passe n'est visible que s'il a été défini par l'admin ou via « mot de passe oublié »."
        action={
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger
                render={
                  <Button size="sm">
                    <UserPlus />
                    Nouveau
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Créer un utilisateur</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={form.handleSubmit(onCreate)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input id="name" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...form.register("email")} />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe initial</Label>
                    <Input
                      id="password"
                      type="text"
                      {...form.register("password")}
                    />
                    {form.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Rôle</Label>
                    <select
                      id="role"
                      className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      {...form.register("role")}
                    >
                      <option value="RH_AGENT">Agent RH</option>
                      <option value="RH_MANAGER">Responsable RH</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting && (
                      <Loader2 className="animate-spin" />
                    )}
                    Créer
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      {loading ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Mot de passe</TableHead>
              <TableHead>Dernier login</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeletonRows rows={5} columns={7} />
          </TableBody>
        </Table>
      ) : users.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun utilisateur. Créez le premier compte.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Mot de passe</TableHead>
              <TableHead>Dernier login</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleLabels[user.role]}</Badge>
                </TableCell>
                <TableCell>
                  {user.canViewPassword && user.viewablePassword ? (
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {revealed[user.id]
                          ? user.viewablePassword
                          : "••••••••"}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setRevealed((r) => ({
                            ...r,
                            [user.id]: !r[user.id],
                          }))
                        }
                      >
                        {revealed[user.id] ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <span
                      className="text-xs text-muted-foreground"
                      title={originLabels[user.passwordOrigin]}
                    >
                      Privé ({originLabels[user.passwordOrigin]})
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatLastLogin(user.lastLoginAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "outline"}>
                    {user.isActive ? "Actif" : "Inactif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ResetPasswordButton userId={user.id} onDone={loadUsers} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => toggleActive(user)}
                  >
                    {user.isActive ? "Désactiver" : "Activer"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

function ResetPasswordButton({
  userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Mot de passe invalide");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success("Mot de passe réinitialisé (visible pour l'admin)");
      setOpen(false);
      setPassword("");
      onDone();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Réinit. MDP
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nouveau mot de passe</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 car., 1 maj., 1 chiffre"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Enregistrer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
