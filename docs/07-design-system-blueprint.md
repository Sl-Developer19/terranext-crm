# 07 — Design System Blueprint

**TerraNext Business OS · Architecture Blueprint**
⚠️ Brand guidelines are an **undelivered dependency** (BRD Section 27). Everything in §1–§2 is a *provisional token set*: values live only in CSS variables + `tailwind.config.ts`, so the brand swap is a token-file change with zero component edits.

---

## 1. Color Tokens

Semantic tokens (ShadCN convention, HSL CSS variables, light + dark):

| Token | Role | Provisional light |
|---|---|---|
| `--background` / `--foreground` | app canvas / text | near-white `0 0% 100%` / slate-900 |
| `--card`, `--popover` | surfaces | white |
| `--primary` | brand actions | deep teal `173 58% 26%` (placeholder until brand) |
| `--secondary` | quiet actions | slate-100 |
| `--muted` / `--muted-foreground` | subdued bg / secondary text | slate-100 / slate-500 |
| `--accent` | hover/selected | slate-100 |
| `--destructive` | delete/revoke | red-600 |
| `--border`, `--input`, `--ring` | lines, focus | slate-200 / primary |

**Status palette** (StatusBadge + charts; fixed semantics, brand-independent):

| Meaning | Token | Used for |
|---|---|---|
| info/new | blue | lead `new`, batch `planned` |
| progress | amber | `follow_up`, `counselling_booked`, `interview` |
| success | green | `admitted`, `placed`, `paid`, `issued` |
| danger | red | `lost`, `overdue`, `revoked`, `dropped` |
| neutral | slate | `archived`, `not_evaluated`, `withdrawn` |

Rules: color never the sole signal (badge always has label — WCAG 1.4.1); text contrast ≥ 4.5:1 both themes; charts (Recharts) read the same CSS variables.

## 2. Typography

- **Family:** Inter (variable, self-hosted via `next/font`) UI + headings; `JetBrains Mono` for IDs (Participant ID, certificate no., receipts — lining figures make IDs scannable).
- Scale (Tailwind): page title `text-2xl font-semibold` · section `text-lg font-semibold` · card title `text-sm font-medium` · body `text-sm` · caption/help `text-xs text-muted-foreground`. Data-dense app ⇒ 14px body baseline.
- Numbers in tables: `tabular-nums`.

## 3. Spacing

4px base grid. Page padding `p-6`; card padding `p-4`/`p-6`; vertical rhythm `space-y-6` (page sections), `space-y-4` (in-card), `gap-4` grids; form field stack `space-y-2`, between fields `space-y-4`. No arbitrary values (`p-[13px]` is lint-flagged) — exceptions require a comment.

## 4. Icons

- **Library: lucide-react only** (already used by the website — visual continuity). Size 16 inline / 20 nav / 24 empty-states, `stroke-width 2`.
- Every nav item and StatusBadge kind has a fixed icon in one registry (`config/icons.ts`) — the same concept never has two icons.
- Icon-only buttons require `aria-label` + tooltip (lint + review checklist).

## 5. Elevation

Flat, border-first (Linear-style): default surfaces = `border` + no shadow; interactive raise on hover = `shadow-sm`; popover/dropdown = `shadow-md`; dialog/sheet = `shadow-lg` + overlay `black/40`. Never stack borders and heavy shadows; dark mode relies on surface tone difference more than shadow.

## 6. Component Standards

- Base: ShadCN components generated into `components/ui`, then **versioned as our code** (edits allowed; provenance comment kept).
- Variants via `class-variance-authority`; no boolean-prop styling forks.
- Every component: typed props (no `any`), forwarded ref where composable, `className` merge via `cn()`, dark-mode verified, keyboard path verified.
- New primitives require: story-style usage example in `docs/components.md` (grows during implementation) + at least one consumer. One-off components stay feature-private until a second consumer promotes them to `components/ui` (rule of two).

## 7. Responsive Breakpoints

Tailwind defaults; app targets:

| Breakpoint | Layout behavior |
|---|---|
| `<768` mobile | sidebar → drawer; tables → card-list transform for key modules (attendance marking is the mobile-critical flow for trainers); KPI row wraps |
| `768–1024` tablet | icon-rail sidebar; 2-col dashboards |
| `1024–1280` laptop | full sidebar, 3-col dashboards |
| `≥1280` desktop | max-w-screen-2xl centered |

NFR: fully responsive desktop/tablet/mobile (BRD Section 22). Trainer attendance entry is designed mobile-first; deep admin tables may require ≥768 and show a "best on a larger screen" notice below that.
