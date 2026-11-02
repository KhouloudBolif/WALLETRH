"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelHeader } from "@/components/ui/panel";
import {
  changePasswordSchema,
  updateProfileSchema,
} from "@/lib/validations/user";

type ProfileForm = z.infer<typeof updateProfileSchema>;
type PasswordForm = z.infer<typeof changePasswordSchema>;

type AccountSettingsProps = {
  initialName: string;
  initialEmail: string;
  canChangePassword: boolean;
};

export function AccountSettings({
  initialName,
  initialEmail,
  canChangePassword,
}: AccountSettingsProps) {
  const { update } = useSession();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: initialName, email: initialEmail },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function onProfileSubmit(values: ProfileForm) {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      await update({ name: data.user.name, email: data.user.email });
      toast.success("Profil mis à jour. Reconnectez-vous si vous avez changé l'email.");
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function onPasswordSubmit(values: PasswordForm) {
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      passwordForm.reset();
      toast.success(data.message ?? "Mot de passe mis à jour.");
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel padding="md" elevated className="enter-fade">
        <PanelHeader
          title="Profil"
          description="Modifier votre nom et votre adresse email."
        />
        <form
          onSubmit={profileForm.handleSubmit(onProfileSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nom</Label>
            <Input id="profile-name" {...profileForm.register("name")} />
            {profileForm.formState.errors.name && (
              <p className="text-sm text-destructive">
                {profileForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              {...profileForm.register("email")}
            />
            {profileForm.formState.errors.email && (
              <p className="text-sm text-destructive">
                {profileForm.formState.errors.email.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={profileLoading}>
            {profileLoading && <Loader2 className="animate-spin" />}
            Enregistrer le profil
          </Button>
        </form>
      </Panel>

      {canChangePassword && (
      <Panel padding="md" elevated className="enter-fade" style={{ animationDelay: "60ms" }}>
        <PanelHeader
          title="Mot de passe"
          description="Après modification, seul vous connaîtrez le nouveau mot de passe (masqué pour l'administrateur)."
        />
        <form
          onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="current-password">Mot de passe actuel</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              {...passwordForm.register("currentPassword")}
            />
            {passwordForm.formState.errors.currentPassword && (
              <p className="text-sm text-destructive">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              {...passwordForm.register("newPassword")}
            />
            {passwordForm.formState.errors.newPassword && (
              <p className="text-sm text-destructive">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmer</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              {...passwordForm.register("confirmPassword")}
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={passwordLoading}>
            {passwordLoading && <Loader2 className="animate-spin" />}
            Changer le mot de passe
          </Button>
        </form>
      </Panel>
      )}
    </div>
  );
}
