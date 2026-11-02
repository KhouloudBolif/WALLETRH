"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  violet: {
    bar: "from-primary to-primary/50",
    text: "text-primary",
    chip: "bg-accent text-primary",
    edge: "from-primary to-primary/40",
    ring: "var(--brand-accent)",
  },
  cyan: {
    bar: "from-gold-ink to-gold",
    text: "text-gold-ink",
    chip: "bg-[oklch(0.95_0.03_82)] text-gold-ink",
    edge: "from-gold-ink to-gold",
    ring: "var(--brand-gold-ink)",
  },
  teal: {
    bar: "from-teal-600 to-teal-300",
    text: "text-teal-700",
    chip: "bg-teal-100 text-teal-700",
    edge: "from-teal-600 to-teal-300",
    ring: "#0f766e",
  },
  rose: {
    bar: "from-rose-500 to-orange-300",
    text: "text-rose-700",
    chip: "bg-rose-100 text-rose-700",
    edge: "from-rose-500 to-orange-300",
    ring: "#e11d48",
  },
} as const;

export type StudioTone = keyof typeof TONE;

export function StudioCard({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/80 bg-card p-4 shadow-elevation-xs sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: StudioTone;
  icon: LucideIcon;
}) {
  const toneClass = TONE[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-elevation-xs">
      <span className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", toneClass.edge)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClass.text)}>{value}</p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={cn("grid size-8 place-items-center rounded-xl", toneClass.chip)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export function ScoreRing({
  ratio,
  label,
  caption,
  tone = "violet",
}: {
  ratio: number;
  label: string;
  caption: string;
  tone?: StudioTone;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const clamped = Math.min(Math.max(ratio, 0), 1);
  const percent = Math.round(clamped * 100);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (drawn ? clamped : 0));

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-28 shrink-0">
        <svg viewBox="0 0 120 120" className="size-full" role="img" aria-label={`${label} ${percent} %`}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" className="text-muted/70" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={TONE[tone].ring}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className={cn("text-xl font-semibold tabular-nums", TONE[tone].text)}>{percent}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

const GENDER_COLOR: Record<string, string> = {
  Femmes: "#0891b2",
  Hommes: "#7c3aed",
  "Non renseigné": "#94a3b8",
};

export function genderColor(label: string): string {
  return GENDER_COLOR[label] ?? "#64748b";
}

export function ShareDonut({
  slices,
  emptyLabel,
}: {
  slices: { label: string; value: number; color: string }[];
  emptyLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const current = slices.find((slice) => slice.label === active) ?? null;

  let cursor = 0;
  const stops =
    total === 0
      ? "var(--muted) 0% 100%"
      : slices
          .map((slice) => {
            const start = cursor;
            cursor += (slice.value / total) * 100;
            return `${slice.color} ${start}% ${cursor}%`;
          })
          .join(", ");

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div
        className="relative size-40 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops})` }}
        role="img"
        aria-label={
          total === 0
            ? emptyLabel
            : slices.map((slice) => `${slice.label} ${Math.round((slice.value / total) * 100)} %`).join(", ")
        }
      >
        <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {current ? current.value : total}
          </span>
          <span className="px-2 text-[10px] leading-tight text-muted-foreground">
            {current ? current.label : emptyLabel}
          </span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {slices.map((slice) => {
          const share = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          const selected = active === slice.label;
          return (
            <li key={slice.label}>
              <button
                type="button"
                onMouseEnter={() => setActive(slice.label)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(slice.label)}
                onBlur={() => setActive(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors",
                  selected ? "bg-muted/70" : "hover:bg-muted/40",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{slice.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {slice.value} · {share}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MeterList({
  rows,
  tone = "violet",
  scale = "max",
  formatValue,
  onRowClick,
}: {
  rows: { key: string; label: string; value: number; detail?: string; interactive?: boolean }[];
  tone?: StudioTone | "status";
  scale?: "max" | "percent";
  formatValue?: (value: number) => string;
  onRowClick?: (key: string) => void;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const width = scale === "percent" ? Math.min(row.value, 100) : (row.value / max) * 100;
        const barClass =
          tone === "status"
            ? row.value >= 80
              ? "bg-(--status-good)"
              : row.value >= 50
                ? "bg-(--status-watch)"
                : "bg-(--status-critical)"
            : cn("bg-gradient-to-r", TONE[tone].bar);
        const rowBody = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs font-medium text-foreground">{row.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatValue ? formatValue(row.value) : row.value}
                {row.detail ? <span className="ml-1.5 text-muted-foreground/80">{row.detail}</span> : null}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/70">
              <div
                className={cn("h-full rounded-full transition-[width] duration-700 ease-out", barClass)}
                style={{ width: drawn ? `${width}%` : "0%" }}
              />
            </div>
          </>
        );
        return (
          <li key={row.key}>
            {onRowClick && row.interactive !== false ? (
              <button
                type="button"
                onClick={() => onRowClick(row.key)}
                className="w-full rounded-lg px-1 py-0.5 text-left hover:bg-muted/50"
              >
                {rowBody}
              </button>
            ) : (
              rowBody
            )}
          </li>
        );
      })}
    </ul>
  );
}
