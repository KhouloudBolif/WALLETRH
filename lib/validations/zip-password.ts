import { z } from "zod";

/** Mot de passe d'export ZIP (plus souple que le mot de passe de compte). */
export const zipPasswordSchema = z
  .string()
  .min(6, "Au moins 6 caractères")
  .max(128, "Mot de passe trop long");
