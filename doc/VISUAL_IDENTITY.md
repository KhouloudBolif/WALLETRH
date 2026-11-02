# Visual identity — Portail RH

> **Living design reference** for developers and Cursor AI.  
> User-facing copy stays **French**; this document is **English**.  
> When you change tokens, components, or layout patterns, **update this file** and [TECHNICAL.md](./TECHNICAL.md) §14.

---

## 1. Design intent

The portal serves an internal HR audience in a **utilities / public-services** context. The UI should feel:

- **Professional** — restrained, trustworthy, not startup-flashy
- **Precise** — clear hierarchy, compact density, no oversized cards
- **Distinct** — warm neutrals + a single **accent red** (no blue, no purple gradients)
- **Discreet** — no client or parent-company names in the product chrome

Avoid “vibe-coded” patterns: generic purple blobs, excessive glassmorphism, oversized hero cards, or rainbow gradients.

---

## 2. Color system

All brand colors live in `app/globals.css` as CSS custom properties. Shadcn tokens (`--primary`, `--accent`, etc.) **map to brand tokens** so buttons, switches, and focus rings stay consistent.

| Token | Role | Light (OKLCH) |
|-------|------|----------------|
| `--brand-bg` | Page background | `oklch(0.985 0.004 55)` warm off-white |
| `--brand-fg` | Primary text | `oklch(0.22 0.012 35)` charcoal |
| `--brand-muted` | Secondary text | `oklch(0.48 0.02 40)` |
| `--brand-charcoal` | Logomark tile | same as `--brand-fg` |
| `--brand-accent` | Primary actions, active nav | `oklch(0.52 0.19 28)` utility red |
| `--brand-accent-hover` | Button hover | `oklch(0.46 0.19 28)` |
| `--brand-accent-soft` | Soft fills, banners, hover | `oklch(0.95 0.03 28)` |
| `--brand-accent-text` | Accent text on light bg | `oklch(0.48 0.17 28)` |
| `--brand-border` | Borders | `oklch(0.9 0.012 50)` |

**Shadcn mapping:** `--primary` = `--brand-accent`, `--accent` = `--brand-accent-soft`.

Dark mode uses the same hue family with adjusted lightness (see `:root` / `.dark` in `globals.css`).

### Do not

- Introduce blue as a brand color (legacy sidebar blue was removed)
- Hardcode hex/red in components — use `bg-primary`, `text-primary`, `var(--brand-*)`, or Tailwind `brand` theme colors
- Use `--destructive` for normal CTAs (reserved for errors / destructive actions)

---

## 3. Typography

| Usage | Font | Notes |
|-------|------|-------|
| UI body | **Plus Jakarta Sans** | `next/font` → `--font-sans` |
| Display / serif headings | **Newsreader** | `next/font` (weights 400/500/600, normal+italic) → `--font-serif`, wired to `--font-heading` |
| Code / matricules (optional) | **JetBrains Mono** | `--font-mono` |

- Page titles (`PageHeader`), panel headers, and hero numbers (`StatTile`) use **`font-serif`** (Newsreader) for a distinct display voice against the Plus Jakarta Sans UI chrome — added in the 2026-07-18 redesign
- Page titles: `font-serif text-2xl font-medium tracking-tight text-balance sm:text-[1.75rem]`
- Panel headers: `font-serif text-base font-medium tracking-tight text-balance`
- Section titles: `text-sm`, `font-medium`
- Body: `text-sm`; meta: `text-xs`, `text-muted-foreground`
- Eyebrows: `text-[11px]`, `uppercase`, `tracking-[0.22em]`

---

## 4. Logomark

**Component:** `components/brand/brand-mark.tsx`

- Charcoal square (`--brand-charcoal`) with **red corner cut** (`--brand-accent`)
- White **RH** monogram
- Sizes: `sm` (header), `md` (landing / auth)

Use alongside the wordmark **Portail RH** — never substitute third-party logos.

---

## 5. Layout patterns

### Surfaces

| Class / component | Use |
|-------------------|-----|
| `.portal-canvas` | Authenticated app + auth form side — flat bg with subtle neutral top wash (no tinted radials) |
| `.brand-grid` | Masked grid overlay (landing, auth panel, optional — keep faint) |
| `Panel` (`components/ui/panel.tsx`) | Compact bordered sections instead of large Cards; `elevated` prop (added 2026-07-18) switches `.shadow-elevation-md` in for the default `.shadow-elevation-xs` |
| `StatChip` | Inline compact metric chip |
| `StatTile` (`components/layout/stat-chip.tsx`, added 2026-07-18) | Hero metric: icon + big serif number + uppercase caption — used in `DashboardHub` |
| `FeatureCard` | Action card with `.lift-on-hover` |

### Elevation & status tokens (added 2026-07-18)

- `--shadow-color`, `--shadow-xs/sm/md/lg` → utility classes `.shadow-elevation-xs/sm/md/lg`. Default `Panel` uses `xs`; `elevated` uses `md`.
- Semantic status colors — deliberately a **different hue family** from `--brand-accent` (which stays reserved for actions/identity): `--status-good/-soft`, `--status-watch/-soft`, `--status-critical/-soft` (light + dark variants). Use for sync-log badges, completeness banners, etc. — never hardcode `amber-*`/`emerald-*`/`red-*` for status meaning.
- Motion utilities: `.enter-fade` (staggered via inline `animationDelay` on siblings) and `.lift-on-hover`, both CSS-only and respecting `prefers-reduced-motion`.

### Navigation

- **Protected header:** sticky, `BrandMark` + serif wordmark, `h-13`, `shadow-elevation-xs`, `backdrop-blur-md`, icon actions, avatar `size-6.5`
- **Portal tabs:** connected-tab style — active item uses `bg-background`, merges with page content, **red top accent** (`inset` shadow on `--brand-accent`); group labels above tab row
- **No demo banner:** `DemoBanner` was removed entirely (2026-07-18) — the portal no longer distinguishes an "exercise data" state from real data now that the real Google Apps Script sync is live

### Density

- Main padding: `px-4 py-5` / `sm:px-6 sm:py-6`
- Prefer **tables** and **inline toolbars** over stacked giant cards
- Max content width: `max-w-7xl` (permissions page may use `max-w-none`)

---

## 6. Page templates

| Area | Route(s) | Identity application |
|------|----------|----------------------|
| **Landing** | `/` | `landing-page`, hero + document preview visual, `HomeHero` |
| **Auth** | `/login`, `/forgot-password`, `/reset-password` | `AuthShell` — charcoal panel + red accent bar; form on `portal-canvas` |
| **Portal** | `/dashboard`, `/admin/*`, `/settings` | `portal-canvas` layout, header, tabs, `Panel` / `StatChip` |
| **Settings** | `/settings` | Inherits portal shell; primary buttons use brand red |

---

## 7. Motion

- **Framer Motion** on landing hero and auth shell only (subtle fade/slide)
- Portal pages: CSS transitions on hovers (`transition-colors`, `duration-200`)
- Permission toggles: instant state + switch animation via `Switch` + `--primary`

---

## 8. French copy tone

- Formal but direct: *Consultez*, *Accéder*, *Autorisé* / *Refusé*
- Internal disclaimer footer on landing: *Portail interne — accès réservé…*

---

## 9. File reference

| File | Purpose |
|------|---------|
| `app/globals.css` | Brand tokens, `.portal-canvas`, `.brand-grid`, landing utilities |
| `components/brand/brand-mark.tsx` | Shared logomark |
| `components/landing/home-hero.tsx` | Public landing |
| `components/auth/auth-shell.tsx` | Auth split layout |
| `components/layout/protected-header.tsx` | App header |
| `components/layout/portal-nav.tsx` | Tab navigation |
| `components/ui/panel.tsx` | Compact panel (`elevated` prop) |
| `components/layout/page-header.tsx` | Serif page titles |
| `components/layout/stat-chip.tsx` | `StatChip` (compact) + `StatTile` (hero) |
| `components/layout/feature-card.tsx` | Lift-on-hover action cards |
| `components/dashboard/dashboard-hub.tsx` | Flagship redesigned page — serif greeting, `StatTile` row, staggered `enter-fade` |
| `components/dashboard/employee-dossier.tsx` | Themed metadata grouping (`groupMetadata()`) |

---

## 10. Checklist for new UI

- [ ] Uses `BrandMark` + “Portail RH” in headers where appropriate
- [ ] Primary actions use default `Button` (brand red) or `buttonVariants`
- [ ] No new blue/purple brand colors
- [ ] Sections use `Panel` or compact tables, not full-width hero cards
- [ ] Copy in French; tokens documented if new CSS variables added
- [ ] Update this file + [TECHNICAL.md](./TECHNICAL.md) §14 if identity changes

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-18 | **Full portal redesign** (branch `redesign/portal-v2`, merged to `main`; landing + login explicitly untouched): Newsreader serif display font (`--font-serif`/`--font-heading`); elevation tokens (`--shadow-xs/sm/md/lg`) + `Panel`'s `elevated` prop; semantic status color tokens (`--status-good/watch/critical` + `-soft`, distinct hue family from `--brand-accent`); `StatTile` hero metric; `.enter-fade`/`.lift-on-hover` motion utilities (reduced-motion aware); dossier metadata grouped into themed sections; `DemoBanner` removed entirely |
| 2026-05-30 | Initial visual identity doc; brand tokens globalized from landing |
| 2026-07-06 | Calm-down pass: removed blurred glow blobs, pink radial washes and glassmorphism (landing, auth, portal canvas); hero visual flattened to a single crisp preview card; red accent reserved for actions/active states — left accent bars removed from `StatChip`/`FeatureCard`; dashboard hub gradient hero replaced by plain page header + flat sections; header gains initials avatar |
| 2026-07-06 | Landing hero reverted to its original stacked-cards/glow-blob version per product decision — the calm-down pass above stays in effect for `.portal-canvas` and the post-login app only; landing/login are out of scope for the portal redesign |
| 2026-07-06 | Post-login consistency pass: `AccountSettings`, `UserManagement`, `SmtpTestCard` converted from ad-hoc shadcn `Card` to shared `Panel`/`PanelHeader`; `/settings` now uses the shared `PageHeader` — closes the last remaining Card-vs-Panel inconsistency across the portal |
