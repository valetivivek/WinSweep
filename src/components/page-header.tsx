import type { ReactNode } from "react";

export interface PageHeroProps {
  metric: ReactNode;
  label: string;
  chips?: ReactNode;
}

interface PageHeaderProps {
  /** Tiny uppercase label above the title. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned actions, e.g. buttons or counts. */
  actions?: ReactNode;
  /** Optional hero strip rendered above the title block on data pages. */
  hero?: PageHeroProps;
}

export function PageHeader({ eyebrow, title, subtitle, actions, hero }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 px-8 pb-6 pt-8">
      {hero && <HeroStrip {...hero} />}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </div>
          )}
          <h1 className="text-3xl font-extrabold leading-none tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2.5 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

function HeroStrip({ metric, label, chips }: PageHeroProps) {
  return (
    <div className="flex items-end justify-between gap-6 pb-2">
      <div className="min-w-0">
        <div className="text-5xl font-bold tabular-nums leading-none tracking-tight text-text">
          {metric}
        </div>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-faint">
          {label}
        </div>
      </div>
      {chips && <div className="flex flex-wrap items-center justify-end gap-1.5">{chips}</div>}
    </div>
  );
}

export function HeroChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
      {children}
    </span>
  );
}
