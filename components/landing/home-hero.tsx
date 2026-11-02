"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileSearch, Lock, Shield } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

const fade = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: 0.06 * i, ease: "easeOut" as const },
  }),
};

export function HomeHero() {
  return (
    <div className="landing-page relative flex min-h-full flex-col overflow-hidden">
      <LandingBackdrop />

      <header className="landing-fade-in relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
        <Link href="/" className="inline-flex min-w-0 items-center">
          <BrandLogo priority className="h-10 sm:h-12" />
        </Link>
        <Link
          href="/login"
          className="landing-ghost-btn group inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors"
        >
          Connexion
          <ArrowRight className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-16 pt-4 sm:px-8 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div>
            <motion.p
              custom={0}
              variants={fade}
              initial="hidden"
              animate="show"
              className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.22em]"
            >
              Ressources humaines
            </motion.p>

            <motion.h1
              custom={1}
              variants={fade}
              initial="hidden"
              animate="show"
              className="mt-4 max-w-xl font-serif text-[2.6rem] leading-[1.05] font-medium tracking-tight sm:text-5xl lg:text-[3.4rem]"
            >
              Consultez les dossiers{" "}
              <span className="landing-accent-text">avec précision</span>
            </motion.h1>

            <motion.p
              custom={2}
              variants={fade}
              initial="hidden"
              animate="show"
              className="mt-5 max-w-md text-base leading-relaxed sm:text-[1.05rem]"
              style={{ color: "var(--landing-muted)" }}
            >
              Recherche, droits d&apos;accès et liens documentaires — un seul point
              d&apos;entrée pour les équipes RH.
            </motion.p>

            <motion.div
              custom={3}
              variants={fade}
              initial="hidden"
              animate="show"
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link href="/login" className="landing-cta group inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium shadow-sm transition-all hover:shadow-md">
                Accéder au portail
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <motion.ul
              custom={4}
              variants={fade}
              initial="hidden"
              animate="show"
              className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs"
              style={{ color: "var(--landing-muted)" }}
            >
              <li className="flex items-center gap-1.5">
                <FileSearch className="size-3.5" style={{ color: "var(--landing-accent)" }} />
                Recherche ciblée
              </li>
              <li className="flex items-center gap-1.5">
                <Lock className="size-3.5" style={{ color: "var(--landing-accent)" }} />
                Accès maîtrisé
              </li>
              <li className="flex items-center gap-1.5">
                <Shield className="size-3.5" style={{ color: "var(--landing-accent)" }} />
                Traçabilité
              </li>
            </motion.ul>
          </div>

          <motion.div
            custom={2}
            variants={fade}
            initial="hidden"
            animate="show"
            className="relative mx-auto w-full max-w-md lg:max-w-none lg:justify-self-end"
          >
            <HeroVisual />
          </motion.div>
        </div>
      </main>

      <footer
        className="landing-fade-in landing-fade-in-delay-4 relative z-10 border-t px-6 py-4 text-center text-[11px] sm:px-8"
        style={{
          borderColor: "var(--landing-border)",
          color: "var(--landing-muted)",
        }}
      >
        Portail interne — accès réservé au personnel autorisé
      </footer>
    </div>
  );
}


function HeroVisual() {
  return (
    <div className="relative aspect-[4/5] max-h-[420px] w-full sm:aspect-square sm:max-h-none">
      {/* Decorative frame */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background:
            "linear-gradient(145deg, var(--landing-accent-soft) 0%, transparent 55%)",
        }}
      />
      <div
        className="absolute -right-3 top-8 h-[72%] w-1 rounded-full bg-gradient-to-b from-gold to-primary opacity-90"
        aria-hidden
      />

      {/* Back card */}
      <div
        className="landing-card absolute left-[8%] top-[12%] h-[58%] w-[78%] rotate-[-3deg] rounded-xl border p-4 opacity-40"
        style={{ borderColor: "var(--landing-border)" }}
      />

      {/* Mid card */}
      <div
        className="landing-card absolute left-[12%] top-[18%] h-[58%] w-[78%] rotate-[1.5deg] rounded-xl border p-4 opacity-65"
        style={{ borderColor: "var(--landing-border)" }}
      />

      {/* Front UI preview */}
      <div
        className="landing-card absolute left-[16%] top-[24%] flex h-[62%] w-[82%] flex-col overflow-hidden rounded-xl border shadow-lg"
        style={{
          borderColor: "var(--landing-border)",
          boxShadow: "0 24px 48px -12px oklch(0.28 0.08 270 / 0.16)",
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: "var(--landing-border)" }}
        >
          <span
            className="size-2 rounded-full"
            style={{ background: "var(--landing-accent)" }}
          />
          <span className="text-[11px] font-medium">Recherche documentaire</span>
        </div>
        <div className="space-y-3 p-4">
          <div
            className="h-8 rounded-md border px-3 text-[10px] leading-8"
            style={{
              borderColor: "var(--landing-border)",
              color: "var(--landing-muted)",
            }}
          >
            Matricule, nom…
          </div>
          <PreviewRow name="Diplôme" status="ok" />
          <PreviewRow name="CIN" status="locked" />
          <PreviewRow name="Contrat" status="ok" />
        </div>
      </div>

      {/* Flow arcs — utility / network motif */}
      <svg
        className="pointer-events-none absolute -bottom-6 -left-6 size-40 opacity-[0.14]"
        viewBox="0 0 160 160"
        fill="none"
        aria-hidden
      >
        <path
          d="M10 120 Q80 20 150 80"
          stroke="var(--landing-accent)"
          strokeWidth="2"
        />
        <path
          d="M20 140 Q90 60 140 100"
          stroke="var(--landing-fg)"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

function PreviewRow({
  name,
  status,
}: {
  name: string;
  status: "ok" | "locked";
}) {
  const isOk = status === "ok";

  return (
    <div
      className="flex items-center justify-between rounded-md border px-3 py-2"
      style={{
        borderColor: "var(--landing-border)",
        opacity: isOk ? 1 : 0.55,
      }}
    >
      <span className="text-[11px] font-medium">{name}</span>
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
        )}
        style={{
          background: isOk ? "var(--landing-accent-soft)" : "var(--landing-border)",
          color: isOk ? "var(--landing-accent)" : "var(--landing-muted)",
        }}
      >
        {isOk ? "Autorisé" : "Refusé"}
      </span>
    </div>
  );
}

function LandingBackdrop() {
  return (
    <>
      <div className="landing-bg" aria-hidden />
      <div className="landing-grid" aria-hidden />
    </>
  );
}
