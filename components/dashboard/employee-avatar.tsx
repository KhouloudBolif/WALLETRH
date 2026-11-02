import { cn, initials } from "@/lib/utils";

const SIZE_CLASSES = {
  xs: "size-6.5 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-lg sm:size-16 sm:text-xl",
  xl: "size-20 text-2xl sm:size-24 sm:text-3xl",
} as const;

type EmployeeAvatarProps = {
  name: string;
  /** Drive photo URL — unset until Phase 2b syncs a codified image file per employee. */
  photoUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
};

export function EmployeeAvatar({ name, photoUrl, size = "md", className }: EmployeeAvatarProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", SIZE_CLASSES[size], className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "brand-mark flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        SIZE_CLASSES[size],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
