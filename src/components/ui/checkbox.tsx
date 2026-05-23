import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

/** Shared selection checkbox visual. Interaction lives on the wrapping control. */
export function Checkbox({ checked, indeterminate }: { checked: boolean; indeterminate?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150",
        checked || indeterminate
          ? "border-accent bg-accent text-accent-contrast"
          : "border-border-strong bg-surface",
      )}
    >
      {checked && <Check size={12} strokeWidth={3} />}
      {!checked && indeterminate && <span className="h-0.5 w-2 rounded-full bg-accent-contrast" />}
    </span>
  );
}
