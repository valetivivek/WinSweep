import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Tiny uppercase label above the title. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned actions, e.g. buttons or counts. */
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4 px-8 pb-6 pt-8">
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
    </header>
  );
}
