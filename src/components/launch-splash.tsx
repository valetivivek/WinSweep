import { useEffect, useState } from "react";

const STATUS_LINES = [
  "Reading installed software",
  "Warming cleanup engine",
  "Checking for updates",
];

interface LaunchSplashProps {
  fadingOut: boolean;
}

export function LaunchSplash({ fadingOut }: LaunchSplashProps) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_LINES.length);
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      aria-hidden={fadingOut}
      className={[
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg",
        "transition-opacity duration-[220ms] ease-out",
        fadingOut ? "opacity-0" : "opacity-100",
      ].join(" ")}
      style={{
        backgroundImage:
          "radial-gradient(at 18% 22%, var(--bg-aurora-a) 0%, transparent 55%), radial-gradient(at 82% 78%, var(--bg-aurora-b) 0%, transparent 55%)",
      }}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="ws-living-dot absolute inset-0 rounded-full bg-accent/30" />
        <span className="absolute inset-2 rounded-full border border-accent/60" />
        <span className="h-3 w-3 rounded-full bg-accent" />
      </div>
      <div className="mt-6 text-sm font-semibold uppercase tracking-[0.32em] text-text">
        WinSweep
      </div>
      <div className="mt-5 h-0.5 w-[200px] overflow-hidden rounded-full bg-surface-active">
        <span className="block h-full w-1/3 animate-[ws-indeterminate_1.2s_ease-in-out_infinite] bg-accent" />
      </div>
      <div className="mt-4 h-4 text-[11px] uppercase tracking-[0.18em] text-text-muted">
        {STATUS_LINES[statusIndex]}
      </div>
    </div>
  );
}
