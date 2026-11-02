import { z } from "zod";
import { passwordSchema } from "@/lib/validations/password";

export const createUserSchema = z.object({
  name: z.string().min(2, "Nom requis").max(120).trim(),
  email: z.string().email("Email invalide").max(254).transform((v) => v.toLowerCase().trim()),
  password: passwordSchema,
  role: z.enum(["ADMIN", "RH_MANAGER", "RH_AGENT"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).trim().optional(),
  email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()).optional(),
  role: z.enum(["ADMIN", "RH_MANAGER", "RH_AGENT"]).optional(),
  isActive: z.boolean().optional(),
});

export const adminResetPasswordSchema = z.object({
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).trim().optional(),
  email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string().max(128),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });
