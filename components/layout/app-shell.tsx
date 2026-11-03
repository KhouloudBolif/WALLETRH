"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  Download,
  Home,
  ListFilter,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@prisma/client";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Menu, MenuContent, MenuLinkItem, MenuTrigger } from "@/components/ui/menu";
import { cn, initials } from "@/lib/utils";

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  RH_MANAGER: "Resp. RH",
  RH_AGENT: "Agent",
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
};

const workspaceNav: NavItem[] = [
  { href: "/dashboard", label: "Accueil", icon: Home, match: (p) => p === "/dashboard" },
  {
    href: "/dashboard/search",
    label: "Recherche",
    icon: Search,
    match: (p) => p === "/dashboard/search",
  },
  {
    href: "/dashboard/requete",
    label: "Requête",
    icon: ListFilter,
    match: (p) => p.startsWith("/dashboard/requete"),
  },
  {
    href: "/dashboard/employees",
    label: "Annuaire",
    icon: Users,
    match: (p) => p.startsWith("/dashboard/employees"),
  },
  {
    href: "/dashboard/completeness",
    label: "Complétude",
    icon: ClipboardCheck,
    match: (p) => p.startsWith("/dashboard/completeness"),
  },
  {
    href: "/dashboard/reporting",
    label: "Rapports",
    icon: BarChart3,
    match: (p) => p.startsWith("/dashboard/reporting"),
  },
];

const syncNav: NavItem = {
  href: "/dashboard/synchronisation",
  label: "Synchronisation",
  icon: RefreshCw,
  match: (p) =>
    p.startsWith("/dashboard/synchronisation") || p.startsWith("/admin/sync"),
};

const downloadHistoryNav: NavItem = {
  href: "/dashboard/historique-telechargements",
  label: "Historique téléchargement",
  icon: Download,
  match: (p) => p.startsWith("/dashboard/historique-telechargements"),
};

/** Sync + historique — visibles pour tous (sous-menu). */
const sharedToolsNav: NavItem[] = [syncNav, downloadHistoryNav];

const adminOnlyNav: NavItem[] = [
  { href: "/admin", label: "Vue d'ensemble", icon: Shield, match: (p) => p === "/admin" },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: Shield,
    match: (p) => p.startsWith("/admin/permissions"),
  },
  {
    href: "/admin/users",
    label: "Utilisateurs",
    icon: UserCog,
    match: (p) => p.startsWith("/admin/users"),
  },
];

/** Admin : outils partagés + écrans admin, dans le même sous-menu. */
const adminNav: NavItem[] = [
  adminOnlyNav[0]!,
  syncNav,
  downloadHistoryNav,
  adminOnlyNav[1]!,
  adminOnlyNav[2]!,
];

type AppShellProps = {
  name: string;
  role: Role;
  children: React.ReactNode;
};

export function AppShell({ name, role, children }: AppShellProps) {
  return (
    <div className="portal-canvas flex min-h-full flex-1 flex-col">
      <Header name={name} role={role} />
      <PortalNav role={role} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

function Header({ name, role }: { name: string; role: Role }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 shadow-elevation-xs backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-primary via-gold to-transparent"
        aria-hidden
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/dashboard" className="inline-flex min-w-0 items-center">
          <BrandLogo priority className="h-9 sm:h-11" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2.5 rounded-full py-1 pr-1 pl-2.5 sm:inline-flex sm:bg-muted/50">
            <span className="text-right text-xs leading-tight">
              <span className="block font-medium text-foreground">{name}</span>
              <span className="block text-[10px] text-muted-foreground">{roleLabels[role]}</span>
            </span>
            <span
              className="brand-mark flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white shadow-elevation-xs"
              aria-hidden
            >
              {initials(name)}
            </span>
          </span>
          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "size-9 rounded-full")}
            title="Paramètres"
          >
            <Settings className="size-4" />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="size-9 rounded-full"
            title="Déconnexion"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function PortalNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN";
  const menuItems = isAdmin ? adminNav : sharedToolsNav;
  const menuActive = menuItems.some((item) => item.match(pathname));

  return (
    <nav className="border-b border-border/70 bg-muted/30" aria-label="Navigation principale">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1.5 overflow-x-auto px-4 sm:gap-2 sm:px-6">
        {workspaceNav.map((item) => (
          <NavPill key={item.href} item={item} pathname={pathname} />
        ))}

        <div className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
        <Menu>
          <MenuTrigger
            className={cn(
              "group/admin-trigger flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              menuActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            <Shield className="size-4" />
            {isAdmin ? "Administration" : "Outils"}
            <ChevronDown className="size-3.5 opacity-60 transition-transform duration-300 ease-out group-data-popup-open/admin-trigger:rotate-180" />
          </MenuTrigger>
          <MenuContent>
            {menuItems.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return (
                <MenuLinkItem
                  key={item.href}
                  render={<Link href={item.href} />}
                  className={active ? "bg-accent text-accent-foreground" : undefined}
                >
                  <Icon className="size-4" />
                  {item.label}
                </MenuLinkItem>
              );
            })}
          </MenuContent>
        </Menu>
      </div>
    </nav>
  );
}

function NavPill({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.match(pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-background hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  );
}
