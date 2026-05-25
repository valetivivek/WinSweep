import { useState } from "react";
import {
  AppWindow,
  BrushCleaning,
  FolderHeart,
  Loader2,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PageId } from "../lib/types";
import { quickSweep } from "../lib/api";
import { useTheme } from "../lib/theme";
import { cn } from "../lib/utils";
import { ConfirmDialog } from "./ui/confirm-dialog";

interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const NAV: NavItem[] = [
  { id: "installed", label: "Installed Apps", icon: AppWindow, hint: "1" },
  { id: "updates", label: "Updates", icon: RefreshCw, hint: "2" },
  { id: "cleanup", label: "Cleanup", icon: BrushCleaning, hint: "3" },
  { id: "app-data", label: "App Data", icon: FolderHeart, hint: "4" },
  { id: "settings", label: "Settings", icon: Settings, hint: "5" },
];

interface SidebarProps {
  active: PageId;
  onNavigate: (page: PageId) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const { mode, toggleMode } = useTheme();
  const [sweepOpen, setSweepOpen] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);

  async function runSweep() {
    setSweepOpen(false);
    setSweeping(true);
    setSweepResult(null);
    try {
      const report = await quickSweep();
      setSweepResult(report.message);
    } catch (e) {
      setSweepResult(String(e));
    } finally {
      setSweeping(false);
    }
  }

  return (
    <>
      <aside
        className="relative flex h-full w-60 flex-col bg-sidebar"
        style={{
          maskImage:
            "linear-gradient(to right, black 0, black calc(100% - 22px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, black 0, black calc(100% - 22px), transparent 100%)",
        }}
      >
        {/* Brand */}
        <div className="px-5 pb-5 pt-7">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-extrabold tracking-tight">WinSweep</span>
            <span className="h-3.5 w-[3px] translate-y-[1px] bg-accent" aria-hidden />
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-faint">
            System Toolkit
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-3 py-2">
          {NAV.map((item) => {
            const isActive = active === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-[background-color,color] duration-150",
                  isActive
                    ? "bg-accent-soft font-semibold text-text"
                    : "text-text-muted hover:bg-surface-hover hover:text-text",
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="ws-living-dot pointer-events-none absolute left-0 top-1/2 h-1.5 w-1.5 -translate-x-2 -translate-y-1/2 rounded-full bg-accent"
                  />
                )}
                <Icon
                  size={17}
                  strokeWidth={2}
                  className={cn(
                    "transition-transform duration-150",
                    isActive ? "text-accent" : "group-hover:scale-110",
                  )}
                />
                <span className="flex-1 text-left">{item.label}</span>
                <kbd
                  className={cn(
                    "rounded border px-1.5 text-[10px] font-medium leading-[1.35]",
                    isActive
                      ? "border-accent/40 text-accent"
                      : "border-border text-text-faint",
                  )}
                >
                  {item.hint}
                </kbd>
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Quick Sweep */}
        <div className="border-t border-border px-3 py-3">
          <button
            onClick={() => setSweepOpen(true)}
            disabled={sweeping}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sweeping ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Wind size={17} strokeWidth={2} />
            )}
            {sweeping ? "Sweeping..." : "Quick Sweep"}
          </button>
          {sweepResult && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-surface-active/60 px-3 py-2 text-[10px] leading-snug text-text-muted">
              <span className="min-w-0 flex-1 break-words">{sweepResult}</span>
              <button
                type="button"
                onClick={() => setSweepResult(null)}
                aria-label="Dismiss"
                className="shrink-0 text-text-faint transition-colors hover:text-text"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <div className="border-t border-border px-3 py-3">
          <button
            onClick={toggleMode}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text"
          >
            <span className="relative flex h-[17px] w-[17px] items-center justify-center">
              <Sun
                size={17}
                strokeWidth={2}
                className={cn(
                  "absolute transition-all duration-300",
                  mode === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
                )}
              />
              <Moon
                size={17}
                strokeWidth={2}
                className={cn(
                  "absolute transition-all duration-300",
                  mode === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
                )}
              />
            </span>
            {mode === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="mt-2 px-3 text-[10px] uppercase tracking-[0.2em] text-text-faint">
            v0.3.0
          </div>
        </div>
      </aside>

      {sweepOpen && (
        <ConfirmDialog
          title="Run a quick sweep now?"
          message={
            <>
              WinSweep will sweep the categories you enabled in{" "}
              <strong>Settings</strong> (Temp, Recycle Bin, app caches). Files go to
              the Recycle Bin so you can restore them.
            </>
          }
          confirmLabel="Sweep now"
          onConfirm={runSweep}
          onCancel={() => setSweepOpen(false)}
        />
      )}
    </>
  );
}
