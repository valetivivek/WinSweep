import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";

const STORAGE_KEY = "winsweep-development-notice-dismissed";

export function DevelopmentNotice() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== "true");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Local storage may be unavailable in restricted WebView contexts.
    }
  }

  if (!visible) return null;

  return (
    <div className="border-b border-warning/35 bg-warning/10 px-8 py-2.5 text-warning">
      <div className="flex items-start gap-3 text-xs leading-5">
        <Info size={16} className="mt-0.5 shrink-0" />
        <p className="min-w-0 flex-1">
          WinSweep is still in development. Some features may not work properly. Review actions
          carefully before deleting files or changing installed software.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss development warning"
          className="rounded p-0.5 text-warning transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/50"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
