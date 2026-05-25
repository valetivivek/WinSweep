import { useEffect, useState } from "react";
import { Sidebar } from "./components/sidebar";
import { DevelopmentNotice } from "./components/development-notice";
import { LaunchSplash } from "./components/launch-splash";
import { InstalledAppsPage } from "./pages/installed-apps";
import { UpdatesPage } from "./pages/updates";
import { CleanupPage } from "./pages/cleanup";
import { AppDataPage } from "./pages/app-data";
import { SettingsPage } from "./pages/settings";
import { listInstalledApps } from "./lib/api";
import type { PageId } from "./lib/types";

const SHORTCUTS: Record<string, PageId> = {
  "1": "installed",
  "2": "updates",
  "3": "cleanup",
  "4": "app-data",
  "5": "settings",
};

const SPLASH_MIN_MS = 600;
const SPLASH_MAX_MS = 6000;
const SPLASH_FADE_MS = 240;

function App() {
  const [page, setPage] = useState<PageId>("installed");
  const [splashFading, setSplashFading] = useState(false);
  const [splashMounted, setSplashMounted] = useState(true);

  useEffect(() => {
    const startedAt = performance.now();

    const warmup = listInstalledApps().catch(() => null);
    const cap = new Promise<void>((resolve) => {
      window.setTimeout(resolve, SPLASH_MAX_MS);
    });

    Promise.race([warmup, cap]).then(() => {
      const elapsed = performance.now() - startedAt;
      const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
      window.setTimeout(() => {
        setSplashFading(true);
        window.setTimeout(() => setSplashMounted(false), SPLASH_FADE_MS);
      }, wait);
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      const target = SHORTCUTS[e.key];
      if (target) {
        e.preventDefault();
        setPage(target);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {splashMounted && <LaunchSplash fadingOut={splashFading} />}
      <div className="flex h-full w-full bg-bg text-text">
        <Sidebar active={page} onNavigate={setPage} />
        <main className="flex h-full min-w-0 flex-1 flex-col">
          <DevelopmentNotice />
          <div key={page} className="ws-page flex min-h-0 flex-1 flex-col">
            {page === "installed" && <InstalledAppsPage />}
            {page === "updates" && <UpdatesPage />}
            {page === "cleanup" && <CleanupPage />}
            {page === "app-data" && <AppDataPage />}
            {page === "settings" && <SettingsPage />}
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
