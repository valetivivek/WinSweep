import { useEffect, useState } from "react";
import { Sidebar } from "./components/sidebar";
import { DevelopmentNotice } from "./components/development-notice";
import { InstalledAppsPage } from "./pages/installed-apps";
import { UpdatesPage } from "./pages/updates";
import { CleanupPage } from "./pages/cleanup";
import { AppDataPage } from "./pages/app-data";
import { SettingsPage } from "./pages/settings";
import type { PageId } from "./lib/types";

const SHORTCUTS: Record<string, PageId> = {
  "1": "installed",
  "2": "updates",
  "3": "cleanup",
  "4": "app-data",
  "5": "settings",
};

function App() {
  const [page, setPage] = useState<PageId>("installed");

  // Number keys jump between pages, unless the user is typing in a field.
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
    <div className="flex h-full w-full bg-bg text-text">
      <Sidebar active={page} onNavigate={setPage} />
      <main className="flex h-full min-w-0 flex-1 flex-col">
        <DevelopmentNotice />
        {/* Keyed so each page remounts and replays its enter animation on nav. */}
        <div key={page} className="ws-page flex min-h-0 flex-1 flex-col">
          {page === "installed" && <InstalledAppsPage />}
          {page === "updates" && <UpdatesPage />}
          {page === "cleanup" && <CleanupPage />}
          {page === "app-data" && <AppDataPage />}
          {page === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

export default App;
