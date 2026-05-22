import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "./button";

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = "danger",
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="ws-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onCancel}
    >
      <div
        className="ws-dialog w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div
            className={
              tone === "danger"
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
            }
          >
            {icon ?? <TriangleAlert size={18} />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-text">{title}</h2>
            <p className="mt-1.5 text-sm text-text-muted">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
