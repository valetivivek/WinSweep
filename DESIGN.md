# WinSweep: Design system

Monospace-forward, terminal-native product UI. One committed accent, tinted
neutrals, crisp dividers, tabular figures. Light is default; dark is first-class.

## Color (OKLCH, tinted toward the iris hue ~285)

Never `#000`/`#fff`; every neutral carries a faint iris tint. Tokens live as CSS
variables in `src/styles/globals.css` and are mapped into Tailwind via
`@theme inline`, so utilities like `bg-surface`, `text-muted`, `border-border`
work and flip with the `.dark` class.

Roles: `bg` (app canvas), `surface` (panels/lists), `surface-hover`,
`surface-active`, `sidebar` (a deeper second neutral layer), `border`,
`border-strong`, `text`, `text-muted`, `text-faint`.

Accent: a single electric iris carries primary actions, current selection, and
focus only, never decoration. `accent`, `accent-hover`, `accent-soft` (low-alpha
tint), `accent-contrast`. Semantic: `success` (green), `danger` (red),
`warning` (amber), used functionally and small.

Color strategy: Restrained content surfaces, with the sidebar and primary
actions earning a Committed accent treatment (filled active nav, solid primary
buttons).

## Typography

- One family: **JetBrains Mono** (400/500/600/700/800), bundled via @fontsource.
  Monospace is the identity, not a display-font violation: labels, data, and
  body all share it. Tabular numerals are on for all sizes, counts, versions.
- Fixed rem scale, contrast through weight not just size. Page titles are large
  and heavy (text-3xl / 800, tight negative tracking). Micro-labels are tiny,
  uppercase, wide-tracked, muted.

## Spacing and layout

- 4px base. Vary padding for rhythm; page gutters are generous (px-8/pt-8),
  rows compact and dense.
- Lists over cards. Full borders only, never side-stripe accents. No nested
  cards. One rounded container per list, hairline dividers inside.
- Side nav + content. Familiar, predictable structure.

## Radius

Crisp and technical: `--radius-md: 0.5rem`, `--radius-lg: 0.75rem`. Pills for
toggles/badges. Applied uniformly.

## Motion

State-driven and snappy (150–240ms), ease-out-expo
`cubic-bezier(0.16, 1, 0.3, 1)`. Entrances are quick and subtle; buttons depress
on active; progress is honest (indeterminate sweep). Respect
`prefers-reduced-motion`. No bounce, no decorative choreography. Helpers in
globals.css: `.ws-page`, `.ws-row`, `.ws-dialog`, `.ws-overlay`,
`ws-indeterminate`.

## Components

Every interactive element ships default / hover / focus / active / disabled, and
loading where it applies. Buttons (primary/default/ghost/danger, sm/md), search
input, segmented sort control, checkbox, location badge, confirm dialog, page
header with optional eyebrow. Empty states teach; loading uses a spinner only
for whole-list fetches, inline progress for per-item work.
