"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  showHomeLink?: boolean;
};

export function AuthShell({ title, description, children, showHomeLink }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-1">
      <motion.aside
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div className="absolute inset-0 bg-[var(--brand-charcoal)]" />
        <div
          className="pointer-events-none absolute -left-24 -top-16 size-[28rem] rounded-full bg-gold/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-[-18%] size-[26rem] rounded-full bg-primary/40 blur-3xl"
          aria-hidden
        />
        <div className="brand-grid absolute inset-0 opacity-30" aria-hidden />

        <div className="relative z-10">
          <div className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-elevation-lg">
            <BrandLogo priority className="h-14 xl:h-16" />
          </div>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
            Ressources humaines
          </p>
          <h2 className="mt-3 max-w-md font-serif text-4xl leading-[1.1] font-medium text-white">
            Accès documentaire{" "}
            <span className="text-gold italic">maîtrisé</span>
          </h2>
        </div>

        <p className="relative z-10 text-sm text-white/55">
          Recherche, permissions et liens Drive — une seule interface.
        </p>
      </motion.aside>

      <div className="portal-canvas relative flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="brand-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="mb-6 lg:hidden">
            <BrandLogo priority className="h-10" />
          </div>
          {showHomeLink && (
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "-ml-2 mb-4 inline-flex items-center gap-1 text-muted-foreground",
              )}
            >
              <ArrowLeft className="size-4" />
              Retour à l&apos;accueil
            </Link>
          )}
          <div className="mb-6">
            <span className="mb-3 block h-0.5 w-8 rounded-full bg-primary" aria-hidden />
            <h1 className="font-serif text-3xl font-medium tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
