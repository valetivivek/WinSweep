import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "default" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-tight " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-150 " +
  "select-none whitespace-nowrap active:scale-[0.97] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-contrast shadow-sm shadow-accent/25 hover:bg-accent-hover",
  default:
    "bg-surface text-text border border-border hover:bg-surface-hover hover:border-border-strong",
  ghost: "text-text-muted hover:bg-surface-hover hover:text-text",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
};

export function Button({
  variant = "default",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}
