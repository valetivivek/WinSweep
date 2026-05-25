import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, FolderOpen, Info, RotateCw, Trash2 } from "lucide-react";
import { HeroChip, PageHeader } from "../components/page-header";
import { SearchInput } from "../components/ui/search-input";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { AppIcon } from "../components/ui/app-icon";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { SkeletonRows } from "../components/ui/skeleton";
import {
  getAppIcons,
  listInstalledApps,
  openInstallLocation,
  uninstallApp,
} from "../lib/api";
import type { InstalledApp } from "../lib/types";
import { formatBytes, formatDate } from "../lib/format";
import { cn } from "../lib/utils";

type SortKey = "name" | "size" | "date";
type SortDir = "asc" | "desc";

const ALL_CATEGORIES = "__all__";

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
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingUninstall, setPendingUninstall] = useState<InstalledApp | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);
    setSelected(new Set());
    setIcons({});
    try {
      const list = await listInstalledApps();
      setApps(list);
      // Icons are fetched in a second pass so the list paints immediately.
      getAppIcons(list.map((a) => a.id))
        .then(setIcons)
        .catch(() => {});
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of apps) if (a.category?.trim()) set.add(a.category.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [apps]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = apps.filter((a) => {
      if (category !== ALL_CATEGORIES && a.category?.trim() !== category) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) || (a.publisher?.toLowerCase().includes(q) ?? false)
      );
    });
    const sorted = [...filtered].sort((a, b) => compare(a, b, sortKey));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [apps, query, category, sortKey, sortDir]);

  const visibleSelectedCount = useMemo(
    () => visible.filter((a) => selected.has(a.id)).length,
    [visible, selected],
  );
  const allVisibleSelected = visible.length > 0 && visibleSelectedCount === visible.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(SORT_OPTIONS.find((o) => o.key === key)!.defaultDir);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const ids = visible.map((a) => a.id);
      const next = new Set(prev);
      if (ids.every((id) => prev.has(id))) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  async function confirmUninstall() {
    if (!pendingUninstall) return;
    const target = pendingUninstall;
    setPendingUninstall(null);
    try {
      await uninstallApp(target.id);
      setNotice(`Uninstaller for ${target.name} launched. Refresh once it finishes.`);
    } catch (e) {
      setError(String(e));
    }
  }

  async function confirmBulkUninstall() {
    const targets = apps.filter((a) => selected.has(a.id));
    setBulkConfirm(false);
    setSelected(new Set());
    let failed = 0;
    for (const t of targets) {
      try {
        await uninstallApp(t.id);
      } catch {
        failed += 1;
      }
    }
    setNotice(
      failed > 0
        ? `Launched ${targets.length - failed} uninstaller(s); ${failed} could not start. Refresh when done.`
        : `Launched ${targets.length} uninstaller(s). Refresh once they finish.`,
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Installed Apps"
        subtitle={
          loading ? "Reading installed software..." : `${apps.length} applications on this system`
        }
        hero={{
          metric: loading ? "--" : apps.length.toLocaleString(),
          label: "Applications · WinSweep",
          chips: (
            <>
              <HeroChip>{loading ? "Scanning" : `${apps.length} total`}</HeroChip>
              {!loading && (
                <HeroChip>
                  {apps.filter((a) => a.category?.trim().toLowerCase() === "store").length} store
                </HeroChip>
              )}
            </>
          ),
        }}
        actions={
          <Button variant="default" onClick={load} disabled={loading}>
            <RotateCw size={15} className={loading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-8 pb-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by name or publisher..."
          className="max-w-sm flex-1"
        />
        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <option value={ALL_CATEGORIES}>All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
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

      {selected.size > 0 && (
        <div className="ws-dialog pointer-events-auto fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-accent/30 bg-surface px-4 py-2 shadow-lg shadow-accent/10">
          <span className="text-xs font-medium text-text">
            {selected.size} app{selected.size === 1 ? "" : "s"} selected
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button variant="danger" size="sm" onClick={() => setBulkConfirm(true)}>
            <Trash2 size={15} />
            Uninstall selected
          </Button>
        </div>
      )}

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
        {error && <ErrorBanner message={error} />}
        {notice && <NoticeBanner message={notice} onDismiss={() => setNotice(null)} />}
        {loading ? (
          <div className="ws-membrane overflow-hidden rounded-lg bg-surface">
            <SkeletonRows count={12} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <div className="ws-membrane overflow-hidden rounded-lg bg-surface">
            <div className="flex items-center gap-6 border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              <button
                onClick={toggleAllVisible}
                aria-label={allVisibleSelected ? "Deselect all" : "Select all"}
                className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Checkbox checked={allVisibleSelected} indeterminate={someVisibleSelected} />
              </button>
              <span className="w-9" aria-hidden />
              <span className="flex-1">Name</span>
              <span className="hidden w-28 text-left sm:block">Version</span>
              <span className="w-20 text-left">Size</span>
              <span className="hidden w-28 text-left md:block">Installed</span>
            </div>
            <ul>
              {visible.map((app, i) => (
                <AppRow
                  key={app.id}
                  app={app}
                  icon={icons[app.id]}
                  index={i}
                  selected={selected.has(app.id)}
                  onToggle={() => toggle(app.id)}
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

      {bulkConfirm && (
        <ConfirmDialog
          title={`Uninstall ${selected.size} app${selected.size === 1 ? "" : "s"}?`}
          message={`This launches ${selected.size} separate uninstaller${
            selected.size === 1 ? "" : "s"
          }, one per app. Each opens its own prompts, so several windows may appear. Follow each to finish.`}
          confirmLabel="Uninstall all"
          onConfirm={confirmBulkUninstall}
          onCancel={() => setBulkConfirm(false)}
        />
      )}
    </>
  );
}

function AppRow({
  app,
  icon,
  index,
  selected,
  onToggle,
  onLocate,
  onUninstall,
}: {
  app: InstalledApp;
  icon?: string;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onLocate: () => void;
  onUninstall: () => void;
}) {
  const details = getAppDetails(app);
  const hoverSummary = getAppHoverSummary(app);

  return (
    <li
      style={{ "--i": Math.min(index, 12) } as CSSProperties}
      className={cn(
        "ws-row ws-vein group relative flex items-center gap-6 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover",
        index > 0 && "border-t border-border",
        selected && "bg-accent-soft/40",
      )}
      title={details}
    >
      <button
        onClick={onToggle}
        aria-label={selected ? `Deselect ${app.name}` : `Select ${app.name}`}
        aria-pressed={selected}
        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Checkbox checked={selected} />
      </button>

      <AppIcon name={app.name} src={icon} />

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{app.name}</div>
        <div className="truncate text-xs text-text-muted group-hover:hidden group-focus-within:hidden">
          {app.publisher || "Unknown publisher"}
        </div>
        <div className="hidden truncate text-xs text-text-muted group-hover:block group-focus-within:block">
          {hoverSummary}
        </div>
        <span className="sr-only">{details}</span>
      </div>

      <div className="hidden w-28 shrink-0 truncate text-left text-xs tabular-nums text-text-muted sm:block">
        {app.version ? `v${app.version}` : "--"}
      </div>
      <div className="w-20 shrink-0 text-left text-xs tabular-nums text-text-muted">
        {formatBytes(app.sizeBytes)}
      </div>
      <div className="hidden w-28 shrink-0 text-left text-xs tabular-nums text-text-muted md:block">
        {formatDate(app.installDate)}
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 bg-gradient-to-l from-surface-hover via-surface-hover to-transparent pl-12 pr-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
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

function getAppHoverSummary(app: InstalledApp): string {
  if (app.description?.trim()) return app.description.trim();

  const parts = [
    app.publisher ? `Publisher: ${app.publisher}` : "Publisher unknown",
    app.version ? `Version: ${app.version}` : "Version unknown",
    `Installed: ${formatDate(app.installDate)}`,
  ];
  if (app.installLocation) parts.push(`Path: ${app.installLocation}`);
  return parts.join(" · ");
}

function getAppDetails(app: InstalledApp): string {
  const parts = [
    app.name,
    app.description?.trim(),
    app.publisher ? `Publisher: ${app.publisher}` : "Publisher unknown",
    app.category ? `Category: ${app.category}` : null,
    app.version ? `Version: ${app.version}` : "Version unknown",
    `Installed: ${formatDate(app.installDate)}`,
    app.installLocation ? `Path: ${app.installLocation}` : "Install path unknown",
  ].filter(Boolean);

  return parts.join(" · ");
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="ws-living-dot mb-4 h-2 w-2 rounded-full bg-accent" />
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

function NoticeBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-text">
      <Info size={16} className="mt-0.5 shrink-0 text-accent" />
      <p className="min-w-0 flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="text-xs font-medium text-text-muted transition-colors hover:text-text"
      >
        Dismiss
      </button>
    </div>
  );
}
