# DESIGN.md — AgentVault Design System

> **Product:** AgentVault
> **Tagline:** Settlement layer for unbanked AI agents
> **Version:** 1.0
> **Aesthetic reference:** Vercel + Linear + Solana Explorer

---

## 1. Brand Identity

### Philosophy

AgentVault is infrastructure, not a consumer app. Every design decision should communicate **precision, determinism, and trust** — the same qualities a clearing house radiates. The aesthetic is terminal-native: what a senior protocol engineer would consider "clean" is the baseline.

No gradients. No blobs. No decorative illustrations. Every pixel earns its place.

### Personality Axes

| Axis | Direction |
|------|-----------|
| Complexity | Dense, information-rich |
| Tone | Serious, technical, slightly cold |
| Energy | Precise, not flashy |
| Trust | Institutional via minimalism |
| Audience | Developers, protocol engineers, auditors |

---

## 2. Color System

### Palette

```css
:root {
  --color-bg-base:        #0a0a0a;
  --color-bg-surface:     #111111;
  --color-bg-elevated:    #1a1a1a;
  --color-bg-overlay:     #222222;
  --color-border-subtle:  #1f1f1f;
  --color-border-default: #2a2a2a;
  --color-border-strong:  #3a3a3a;
  --color-accent-primary:       #4ade80;
  --color-accent-primary-dim:   #22c55e;
  --color-accent-primary-glow:  rgba(74, 222, 128, 0.12);
  --color-accent-secondary:     #a3e635;
  --color-accent-secondary-dim: #84cc16;
  --color-text-primary:   #ffffff;
  --color-text-secondary: #d1d5db;
  --color-text-muted:     #6b7280;
  --color-text-disabled:  #374151;
  --color-success:  #4ade80;
  --color-error:    #f87171;
  --color-warning:  #fbbf24;
  --color-info:     #60a5fa;
  --color-syntax-keyword: #4ade80;
  --color-syntax-string:  #a3e635;
  --color-syntax-comment: #4b5563;
  --color-syntax-number:  #60a5fa;
  --color-syntax-type:    #c084fc;
}
```

---

## 3. Typography

```css
:root {
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-ui:   'Inter', -apple-system, sans-serif;
  --text-xs:   0.6875rem;
  --text-sm:   0.8125rem;
  --text-base: 0.9375rem;
  --text-md:   1.0625rem;
  --text-lg:   1.25rem;
  --text-xl:   1.5rem;
  --text-2xl:  2rem;
  --text-3xl:  2.75rem;
  --text-4xl:  3.5rem;
  --leading-tight:  1.2;
  --leading-snug:   1.35;
  --leading-normal: 1.5;
  --leading-code:   1.65;
  --tracking-tight:  -0.02em;
  --tracking-normal:  0em;
  --tracking-wide:    0.06em;
  --tracking-wider:   0.1em;
}
```

**Headlines** — Inter, weight 500-600, --tracking-tight.
**Code/addresses/hashes/tx IDs** — always JetBrains Mono. Non-negotiable.
**Labels** — Inter, --text-xs, --tracking-wide, ALL CAPS, --color-text-muted.
**Numbers and amounts** — JetBrains Mono for all numeric protocol data.

---

## 4. Logo & Monogram

Shape: Square or hexagonal bounding box. Letters: AV, geometric sans.
Color: #4ade80 on #0a0a0a. The "A" and "V" share a vertex — chevron/arrow implies settlement directionality.
Wordmark: AgentVault — Inter, weight 600, #ffffff.
Never apply glow, drop-shadow, or gradient to the logo.

---

## 5. Layout System

```css
:root {
  --grid-cols: 12;
  --grid-gutter: 1.5rem;
  --grid-margin: 2rem;
  --content-max:   1280px;
  --content-prose:  720px;
  --space-1:  4px;  --space-2:  8px;   --space-3:  12px;
  --space-4:  16px; --space-6:  24px;  --space-8:  32px;
  --space-12: 48px; --space-16: 64px;  --space-24: 96px;
}
```

Density: dense by design. Default padding --space-3 (12px), not SaaS --space-6.
Think: Bloomberg terminal meets Solana Explorer.

---

## 6. Component Patterns

```css
.card { background: var(--color-bg-surface); border: 1px solid var(--color-border-default); border-radius: 4px; padding: var(--space-4); }
.card:hover { border-color: var(--color-border-strong); }
.card--active { border-color: var(--color-accent-primary); box-shadow: 0 0 0 1px var(--color-accent-primary-glow); }

.btn-primary { background: var(--color-accent-primary); color: #000000; font-weight: 600; font-size: var(--text-sm); padding: 6px 16px; border-radius: 3px; letter-spacing: var(--tracking-wide); text-transform: uppercase; }
.btn-secondary { background: transparent; color: var(--color-text-primary); border: 1px solid var(--color-border-strong); border-radius: 3px; padding: 6px 16px; }
.btn-secondary:hover { border-color: var(--color-accent-primary); color: var(--color-accent-primary); }

.badge { font-family: var(--font-mono); font-size: var(--text-xs); padding: 2px 8px; border-radius: 2px; letter-spacing: var(--tracking-wide); text-transform: uppercase; }
.badge--settled  { color: #4ade80; background: rgba(74,222,128,0.1); }
.badge--pending  { color: #fbbf24; background: rgba(251,191,36,0.1); }
.badge--reverted { color: #f87171; background: rgba(248,113,113,0.1); }
.badge--locked   { color: #60a5fa; background: rgba(96,165,250,0.1); }
.badge--init     { color: #6b7280; background: rgba(107,114,128,0.1); }

.address { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text-secondary); cursor: pointer; }
.address:hover { color: var(--color-accent-primary); }

.data-table th { font-family: var(--font-ui); font-size: var(--text-xs); font-weight: 500; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: var(--tracking-wide); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-default); }
.data-table td { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text-primary); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-subtle); }
.data-table tr:hover td { background: var(--color-bg-overlay); }
```

---

## 7. Code & Terminal Aesthetics

```css
.code-block { background: var(--color-bg-elevated); border: 1px solid var(--color-border-default); border-left: 3px solid var(--color-accent-primary); border-radius: 3px; padding: var(--space-4); font-family: var(--font-mono); font-size: var(--text-sm); line-height: var(--leading-code); overflow-x: auto; }

@keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.cursor { display: inline-block; width: 2px; height: 1em; background: var(--color-accent-primary); animation: cursor-blink 1.1s step-end infinite; vertical-align: text-bottom; margin-left: 2px; }
```

Terminal output: prompt `$` in --color-text-muted, success lines in --color-accent-primary, errors in --color-error.

---

## 8. Motion & Interaction

```css
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 120ms;
  --duration-base: 180ms;
  --duration-slow: 250ms;
}
.interactive { transition: color var(--duration-fast) var(--ease-out-expo), border-color var(--duration-fast) var(--ease-out-expo), background var(--duration-fast) var(--ease-out-expo); }
```

No bounces, no springs on data-critical UI. Animation must feel deterministic.

---

## 9. Iconography

Use Phosphor Icons (thin/regular) or Lucide. 14-16px in tables, 18-20px in navigation.
Never solid/filled icons next to text in dense UI — prefer outline.

---

## 10. Anti-Patterns

| Forbidden | Instead |
|---|---|
| Gradient backgrounds | Flat #0a0a0a or #111111 |
| Blob / organic shapes | Rectangles, hairlines, geometric fills |
| Rounded corners > 6px on cards | border-radius: 3-4px |
| Colorful illustrations | Data, code, structured text |
| Glassmorphism / frosted panels | Solid surface with border |
| Purple/blue AI clichés | Black, white, green only |
| Large hero images | Terminal output, code snippets |
| Emoji in UI elements | Phosphor icons |
| Helvetica Neue or Roboto | Inter + JetBrains Mono only |
| Drop shadows on cards | Borders only |
| Loading spinners | Skeleton rows with --color-bg-elevated |

---

## 11. Dark Mode Note

AgentVault is **dark-only**. No light mode. The product lives in terminals at 2 AM.

---

## 12. Accessibility Baseline

| Pairing | Ratio | WCAG |
|---|---|---|
| #ffffff on #0a0a0a | 21:1 | AAA |
| #4ade80 on #0a0a0a | 8.1:1 | AAA |
| #6b7280 on #0a0a0a | 4.6:1 | AA |
| #000000 on #4ade80 | 8.1:1 | AAA (button text) |

Focus states: `outline: 2px solid var(--color-accent-primary); outline-offset: 2px`

---

*DESIGN.md is a living document. All Claude sessions building AgentVault UI should reference this file before generating any visual output.*
