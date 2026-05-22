import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, FolderOpen, Loader2, RotateCw, Trash2 } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { SearchInput } from "../components/ui/search-input";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { listInstalledApps, openInstallLocation, uninstallApp } from "../lib/api";
import type { InstalledApp } from "../lib/types";
import { formatBytes, formatDate } from "../lib/format";
import { cn } from "../lib/utils";

type SortKey = "name" | "size" | "date";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string; defaultDir: SortDir }[] = [
  { key: "name", label: "Name", defaultDir: "asc" },
  { key: "size", label: "Size", defaultDir: "desc" },
  { key: "date", label: "Installed", defaultDir: "desc" },
];

function compare(a: InstalledApp, b: InstalledApp, key: SortKey): number {
  if (key === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (key === "size") {
    if (a.sizeBytes === null) return 1;
    if (b.sizeBytes === null) return -1;
    return a.sizeBytes - b.sizeBytes;
  }
  const at = a.installDate ? new Date(a.installDate).getTime() : -Infinity;
  const bt = b.installDate ? new Date(b.installDate).getTime() : -Infinity;
  return at - bt;
}

export function InstalledAppsPage() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pendingUninstall, setPendingUninstall] = useState<InstalledApp | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setApps(await listInstalledApps());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps;
    const sorted = [...filtered].sort((a, b) => compare(a, b, sortKey));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [apps, query, sortKey, sortDir]);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(SORT_OPTIONS.find((o) => o.key === key)!.defaultDir);
    }
  }

  async function confirmUninstall() {
    if (!pendingUninstall) return;
    const target = pendingUninstall;
    setPendingUninstall(null);
    try {
      await uninstallApp(target.id);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Installed Apps"
        subtitle={
          loading ? "Reading installed software..." : `${apps.length} applications on this system`
        }
        actions={
          <Button variant="default" onClick={load} disabled={loading}>
            <RotateCw size={15} className={loading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-8 pb-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search apps..."
          className="max-w-sm flex-1"
        />
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
          {SORT_OPTIONS.map((opt) => {
            const active = opt.key === sortKey;
            return (
              <button
                key={opt.key}
                onClick={() => onSort(opt.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-text-muted hover:bg-surface-hover hover:text-text",
                )}
              >
                {opt.label}
                {active && (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
        {error && <ErrorBanner message={error} />}
        {loading ? (
          <LoadingState label="Scanning installed apps" />
        ) : visible.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-4 border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              <span className="flex-1">Name</span>
              <span className="hidden w-28 text-right sm:block">Version</span>
              <span className="w-20 text-right">Size</span>
              <span className="hidden w-28 text-right md:block">Installed</span>
              <span className="w-[150px]" aria-hidden />
            </div>
            <ul>
              {visible.map((app, i) => (
                <AppRow
                  key={app.id}
                  app={app}
                  index={i}
                  onLocate={() => app.installLocation && openInstallLocation(app.installLocation)}
                  onUninstall={() => setPendingUninstall(app)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {pendingUninstall && (
        <ConfirmDialog
          title={`Uninstall ${pendingUninstall.name}?`}
          message="This launches the app's uninstaller. Follow its prompts to finish removing the software."
          confirmLabel="Uninstall"
          onConfirm={confirmUninstall}
          onCancel={() => setPendingUninstall(null)}
        />
      )}
    </>
  );
}

function AppRow({
  app,
  index,
  onLocate,
  onUninstall,
}: {
  app: InstalledApp;
  index: number;
  onLocate: () => void;
  onUninstall: () => void;
}) {
  return (
    <li
      style={{ "--i": Math.min(index, 12) } as CSSProperties}
      className={cn(
        "ws-row group flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover",
        index > 0 && "border-t border-border",
      )}
    >
      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{app.name}</div>
        <div className="truncate text-xs text-text-muted">{app.publisher || "Unknown publisher"}</div>
      </div>

      {/* Meta */}
      <div className="hidden w-28 shrink-0 truncate text-right text-xs text-text-muted sm:block">
        {app.version ? `v${app.version}` : "--"}
      </div>
      <div className="w-20 shrink-0 text-right text-xs tabular-nums text-text-muted">
        {formatBytes(app.sizeBytes)}
      </div>
      <div className="hidden w-28 shrink-0 text-right text-xs tabular-nums text-text-muted md:block">
        {formatDate(app.installDate)}
      </div>

      {/* Actions, revealed on hover */}
      <div className="flex w-[150px] shrink-0 justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          title="Open file location"
          disabled={!app.installLocation}
          onClick={onLocate}
        >
          <FolderOpen size={15} />
          Locate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title="Uninstall"
          className="hover:text-danger"
          onClick={onUninstall}
        >
          <Trash2 size={15} />
        </Button>
      </div>
    </li>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Loader2 size={24} className="animate-spin text-accent" />
      <p className="mt-4 text-sm text-text-muted">{label}</p>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
      <p className="text-sm font-medium text-text">No apps found</p>
      <p className="mt-1 text-xs text-text-muted">
        {query ? `Nothing matches "${query}".` : "No installed applications were detected."}
      </p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}
