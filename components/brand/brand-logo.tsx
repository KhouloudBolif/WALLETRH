import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Lockup WalletRH recadré (1400×368, ratio ≈ 3,8:1).
 * La hauteur se règle via className (h-*) ; la largeur suit automatiquement.
 */
const LOCKUP = {
  src: "/images/logo-lockup.webp",
  width: 1400,
  height: 368,
} as const;

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src={LOCKUP.src}
      alt="WalletRH"
      width={LOCKUP.width}
      height={LOCKUP.height}
      priority={priority}
      unoptimized
      className={cn("h-10 w-auto max-w-full object-contain", className)}
      style={{ width: "auto" }}
    />
  );
}
