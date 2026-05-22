import { AppWindow, RefreshCw, Sparkles, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PageId } from "../lib/types";
import { useTheme } from "../lib/theme";
import { cn } from "../lib/utils";

interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const NAV: NavItem[] = [
  { id: "installed", label: "Installed Apps", icon: AppWindow, hint: "1" },
  { id: "updates", label: "Updates", icon: RefreshCw, hint: "2" },
  { id: "cleanup", label: "Cleanup", icon: Sparkles, hint: "3" },
];

interface SidebarProps {
  active: PageId;
  onNavigate: (page: PageId) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const { mode, toggleMode } = useTheme();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
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
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-[background-color,color,box-shadow] duration-150",
                isActive
                  ? "bg-accent font-semibold text-accent-contrast shadow-sm shadow-accent/30"
                  : "text-text-muted hover:bg-surface-hover hover:text-text",
              )}
            >
              <Icon
                size={17}
                strokeWidth={2}
                className={cn(
                  "transition-transform duration-150",
                  !isActive && "group-hover:scale-110",
                )}
              />
              <span className="flex-1 text-left">{item.label}</span>
              <kbd
                className={cn(
                  "rounded border px-1.5 text-[10px] font-medium leading-[1.35]",
                  isActive
                    ? "border-accent-contrast/30 text-accent-contrast/75"
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
          v0.1.0
        </div>
      </div>
    </aside>
  );
}
