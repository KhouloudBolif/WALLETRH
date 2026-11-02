import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Au moins 8 caractères")
  .max(128, "Mot de passe trop long")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre");

export const emailSchema = z
  .string()
  .email("Email invalide")
  .max(254)
  .transform((v) => v.toLowerCase().trim());
