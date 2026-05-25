import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Check,
  ChevronDown,
  Database,
  Eye,
  EyeOff,
  File as FileIcon,
  Folder,
  Loader2,
  RotateCw,
  Trash2,
} from "lucide-react";
import { HeroChip, PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { SearchInput } from "../components/ui/search-input";
import { SkeletonRows } from "../components/ui/skeleton";
import {
  addIgnored,
  clearIgnored,
  deleteResiduals,
  listIgnored,
  scanResiduals,
} from "../lib/api";
import type {
  ResidualCategory,
  ResidualItem,
  ResidualKind,
  ResidualLocation,
} from "../lib/types";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/utils";

type ScanState = "scanning" | "results";
type CategoryFilter = ResidualCategory | "All";

const SCAN_TARGETS: ResidualLocation[] = [
  "AppData",
  "LocalAppData",
  "ProgramData",
  "Temp",
  "Registry",
];

const CATEGORIES: ResidualCategory[] = [
  "Logs",
  "Cache",
  "Config",
  "Data",
  "Crashes",
  "Installer",
  "Other",
];

const KIND_ICON: Record<ResidualKind, typeof Folder> = {
  folder: Folder,
  file: FileIcon,
  registry: Database,
};

/* Tailwind tints per category. Kept muted so they read as labels, not alerts. */
const CATEGORY_TONE: Record<ResidualCategory, string> = {
  Logs: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  Cache: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300",
  Config: "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300",
  Data: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  Crashes: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300",
  Installer: "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-300",
  Other: "bg-surface-active text-text-muted border-border",
};

export function CleanupPage() {
  const [state, setState] = useState<ScanState>("scanning");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResidualItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [collapsedApps, setCollapsedApps] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const interval = useRef<number | null>(null);

  const refreshIgnored = useCallback(() => {
    listIgnored()
      .then((l) => setIgnoredCount(l.length))
      .catch(() => {});
  }, []);

  // Auto-scan on open, per the design brief. Re-runnable via "Scan again".
  async function startScan() {
    if (interval.current) window.clearInterval(interval.current);
    setState("scanning");
    setProgress(0);
    setResults([]);
    setSelected(new Set());
    setQuery("");
    setCategoryFilter("All");
    setCollapsedApps(new Set());
    setError(null);

    // Drive an indeterminate-feeling progress bar up to 90% while we wait, so
    // the scan never looks stalled regardless of how long the backend takes.
    interval.current = window.setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(1, Math.round((90 - p) / 8))));
    }, 90);

    try {
      const items = await scanResiduals();
      setResults(items);
      refreshIgnored();
    } catch (e) {
      setError(String(e));
      setResults([]);
    } finally {
      if (interval.current) window.clearInterval(interval.current);
      setProgress(100);
      // Brief beat at 100% before revealing results.
      window.setTimeout(() => setState("results"), 180);
    }
  }

  useEffect(() => {
    startScan();
    return () => {
      if (interval.current) window.clearInterval(interval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalReclaimable = useMemo(
    () => results.filter((r) => selected.has(r.id)).reduce((sum, r) => sum + r.sizeBytes, 0),
    [results, selected],
  );

  // Chip counts use unfiltered results so they don't change as you click around.
  const categoryStats = useMemo(() => {
    const stats = new Map<CategoryFilter, { count: number; bytes: number }>();
    const all = { count: results.length, bytes: results.reduce((s, r) => s + r.sizeBytes, 0) };
    stats.set("All", all);
    for (const cat of CATEGORIES) {
      const items = results.filter((r) => r.category === cat);
      stats.set(cat, { count: items.length, bytes: items.reduce((s, r) => s + r.sizeBytes, 0) });
    }
    return stats;
  }, [results]);

  const visibleResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    return results.filter((item) => {
      if (categoryFilter !== "All" && item.category !== categoryFilter) return false;
      if (terms.length === 0) return true;
      const fileName = residualName(item.path);
      const extension = residualExtension(fileName);
      const searchable = [
        item.relatedTo,
        item.kind,
        item.location,
        item.category,
        item.path,
        fileName,
        extension,
        formatBytes(item.sizeBytes),
        item.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((term) => searchable.includes(term));
    });
  }, [query, results, categoryFilter]);

  // Group visible items by inferred app so the user reads "what's leftover for
  // Slack" rather than scanning a flat list. Largest groups first.
  const groups = useMemo(() => {
    const map = new Map<string, ResidualItem[]>();
    for (const item of visibleResults) {
      const arr = map.get(item.relatedTo);
      if (arr) arr.push(item);
      else map.set(item.relatedTo, [item]);
    }
    return Array.from(map.entries())
      .map(([app, items]) => ({
        app,
        items,
        totalBytes: items.reduce((sum, r) => sum + r.sizeBytes, 0),
      }))
      .sort((a, b) => b.totalBytes - a.totalBytes || a.app.localeCompare(b.app));
  }, [visibleResults]);

  const visibleSelectedCount = useMemo(
    () => visibleResults.filter((r) => selected.has(r.id)).length,
    [selected, visibleResults],
  );

  const hiddenSelectedCount = selected.size - visibleSelectedCount;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const visibleIds = visibleResults.map((r) => r.id);
      const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of visibleIds) {
        allVisibleSelected ? next.delete(id) : next.add(id);
      }
      return next;
    });
  }

  function toggleGroup(items: ResidualItem[]) {
    setSelected((prev) => {
      const ids = items.map((r) => r.id);
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        allSelected ? next.delete(id) : next.add(id);
      }
      return next;
    });
  }

  function toggleCollapsed(app: string) {
    setCollapsedApps((prev) => {
      const next = new Set(prev);
      next.has(app) ? next.delete(app) : next.add(app);
      return next;
    });
  }

  async function confirmDelete() {
    setConfirming(false);
    setDeleting(true);
    setError(null);
    const targets = results.filter((r) => selected.has(r.id));
    try {
      const report = await deleteResiduals(targets);
      const removed = new Set(report.deletedIds);
      setResults((prev) => prev.filter((r) => !removed.has(r.id)));
      setSelected(new Set());
      if (report.errors.length > 0) {
        setError(`${report.errors.length} item(s) could not be removed: ${report.errors[0]}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  }

  // Permanently exclude an item from future scans, and drop it from this one.
  async function ignore(item: ResidualItem) {
    try {
      await addIgnored([item.path]);
      setResults((prev) => prev.filter((r) => r.id !== item.id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      refreshIgnored();
    } catch (e) {
      setError(String(e));
    }
  }

  // Forget every ignored path and rescan so they reappear.
  async function resetIgnored() {
    try {
      await clearIgnored();
      startScan();
    } catch (e) {
      setError(String(e));
    }
  }

  const allVisibleSelected =
    visibleResults.length > 0 && visibleResults.every((r) => selected.has(r.id));
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  const totalReclaimableAll = useMemo(
    () => results.reduce((sum, r) => sum + r.sizeBytes, 0),
    [results],
  );

  useEffect(() => {
    const warm = state === "results" && results.length > 0;
    document.body.classList.toggle("ws-warm", warm);
    return () => document.body.classList.remove("ws-warm");
  }, [state, results.length]);

  return (
    <>
      <PageHeader
        eyebrow="Reclaim Space"
        title="Cleanup"
        subtitle={
          state === "scanning"
            ? "Scanning for leftover files and registry keys"
            : results.length === 0
              ? "No residual files found"
              : `${results.length} leftover item${results.length === 1 ? "" : "s"} found · ${formatBytes(
                  totalReclaimableAll,
                )} reclaimable`
        }
        hero={{
          metric: state === "scanning" ? "--" : formatBytes(totalReclaimableAll),
          label: "Residual · Scan",
          chips: (
            <>
              <HeroChip>
                {state === "scanning"
                  ? "Scanning"
                  : `${results.length} item${results.length === 1 ? "" : "s"}`}
              </HeroChip>
              {state === "results" && results.length > 0 && <HeroChip>Action needed</HeroChip>}
            </>
          ),
        }}
        actions={
          state === "results" && (
            <div className="flex items-center gap-2">
              {ignoredCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={resetIgnored}
                  disabled={deleting}
                  title="Restore ignored items and rescan"
                >
                  <Eye size={15} />
                  {ignoredCount} ignored
                </Button>
              )}
              <Button variant="default" onClick={startScan} disabled={deleting}>
                <RotateCw size={15} />
                Scan again
              </Button>
            </div>
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col px-8 pb-8">
        {error && <ErrorBanner message={error} />}
        {state === "scanning" ? (
          <ScanProgress progress={progress} />
        ) : results.length === 0 ? (
          <Spotless />
        ) : (
          <>
            {/* Review toolbar */}
            <div className="mb-3 flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search orphan files, paths, .log, registry..."
                  className="w-full lg:max-w-xl"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={toggleAllVisible}
                    disabled={visibleResults.length === 0}
                    className="flex items-center gap-2 text-xs font-medium text-text-muted transition-colors hover:text-text disabled:pointer-events-none disabled:opacity-45"
                  >
                    <Checkbox checked={allVisibleSelected} indeterminate={someVisibleSelected} />
                    {allVisibleSelected ? "Deselect shown" : "Select shown"}
                    <span className="text-text-faint">
                      ({visibleSelectedCount} of {visibleResults.length})
                    </span>
                  </button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={selected.size === 0 || deleting}
                    onClick={() => setConfirming(true)}
                  >
                    {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    Delete selected ({formatBytes(totalReclaimable)})
                  </Button>
                </div>
              </div>
              <CategoryChips
                stats={categoryStats}
                active={categoryFilter}
                onChange={setCategoryFilter}
              />
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-faint">
                <span>
                  {query || categoryFilter !== "All"
                    ? `${visibleResults.length} of ${results.length} orphan item${
                        results.length === 1 ? "" : "s"
                      } shown`
                    : `${results.length} orphan item${results.length === 1 ? "" : "s"} shown`}
                </span>
                {hiddenSelectedCount > 0 && (
                  <span className="rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-warning">
                    {hiddenSelectedCount} selected outside this view
                  </span>
                )}
              </div>
            </div>

            {/* Results, grouped by inferred app */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {visibleResults.length === 0 ? (
                <NoMatches query={query} categoryFilter={categoryFilter} />
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => {
                    const collapsed = collapsedApps.has(group.app);
                    const groupSelected = group.items.filter((r) => selected.has(r.id)).length;
                    const allGroupSelected = groupSelected === group.items.length;
                    const someGroupSelected = groupSelected > 0 && !allGroupSelected;
                    return (
                      <section
                        key={group.app}
                        className="ws-membrane overflow-hidden rounded-lg bg-surface"
                      >
                        <GroupHeader
                          app={group.app}
                          itemCount={group.items.length}
                          totalBytes={group.totalBytes}
                          collapsed={collapsed}
                          allSelected={allGroupSelected}
                          someSelected={someGroupSelected}
                          onToggleCollapsed={() => toggleCollapsed(group.app)}
                          onToggleAll={() => toggleGroup(group.items)}
                        />
                        {!collapsed && (
                          <ul>
                            {group.items.map((item, i) => (
                              <ResidualRow
                                key={item.id}
                                item={item}
                                checked={selected.has(item.id)}
                                divided
                                index={i}
                                onToggle={() => toggle(item.id)}
                                onIgnore={() => ignore(item)}
                              />
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Delete ${selected.size} item${selected.size === 1 ? "" : "s"}?`}
          message={
            <>
              Selected files and folders are moved to the Recycle Bin, reclaiming{" "}
              {formatBytes(totalReclaimable)}, so you can restore them if needed. Registry keys are
              removed permanently. WinSweep is still in development, review the selected paths
              carefully before continuing.
            </>
          }
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

function residualName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function residualExtension(name: string): string {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return "";
  return name.slice(index).toLowerCase();
}

function ResidualRow({
  item,
  checked,
  divided,
  index,
  onToggle,
  onIgnore,
}: {
  item: ResidualItem;
  checked: boolean;
  divided: boolean;
  index: number;
  onToggle: () => void;
  onIgnore: () => void;
}) {
  const Icon = KIND_ICON[item.kind];
  return (
    <li
      style={{ "--i": Math.min(index, 12) } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-pressed={checked}
      aria-label={`${checked ? "Deselect" : "Select"} ${item.relatedTo} (${item.path})`}
      className={cn(
        "ws-row ws-vein group relative flex cursor-pointer items-center gap-6 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40",
        divided && "border-t border-border",
      )}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <Checkbox checked={checked} />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-active text-text-muted">
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{item.relatedTo}</div>
        <div className="truncate font-mono text-xs text-text-muted">{item.path}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <CategoryBadge category={item.category} />
        <LocationBadge location={item.location} />
      </div>
      <div className="w-20 shrink-0 text-left text-xs tabular-nums text-text-muted">
        {item.kind === "registry" ? "key" : formatBytes(item.sizeBytes)}
      </div>
      <button
        type="button"
        title="Never flag this again"
        aria-label={`Ignore ${item.relatedTo} in future scans`}
        onClick={(e) => {
          e.stopPropagation();
          onIgnore();
        }}
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center bg-gradient-to-l from-surface-hover via-surface-hover to-transparent pl-12 pr-1 text-text-faint opacity-0 transition-[opacity,color] duration-150 hover:text-text group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none"
      >
        <EyeOff size={15} />
      </button>
    </li>
  );
}

function LocationBadge({ location }: { location: ResidualLocation }) {
  return (
    <span className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-faint sm:inline">
      {location}
    </span>
  );
}

function CategoryBadge({ category }: { category: ResidualCategory }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        CATEGORY_TONE[category],
      )}
    >
      {category}
    </span>
  );
}

function CategoryChips({
  stats,
  active,
  onChange,
}: {
  stats: Map<CategoryFilter, { count: number; bytes: number }>;
  active: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
}) {
  // "All" always shows; per-category chips only render when scan found at
  // least one item in that bucket, so the strip doesn't pad empty noise.
  const chips: CategoryFilter[] = ["All", ...CATEGORIES.filter((c) => (stats.get(c)?.count ?? 0) > 0)];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => {
        const s = stats.get(chip) ?? { count: 0, bytes: 0 };
        const isActive = chip === active;
        return (
          <button
            key={chip}
            type="button"
            onClick={() => onChange(chip)}
            aria-pressed={isActive}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface text-text-muted hover:border-accent/40 hover:text-text",
            )}
          >
            <span>{chip}</span>
            <span className={cn("tabular-nums", isActive ? "opacity-90" : "text-text-faint")}>
              {s.count}
            </span>
            {s.bytes > 0 && (
              <span className={cn("tabular-nums", isActive ? "opacity-75" : "text-text-faint")}>
                · {formatBytes(s.bytes)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function GroupHeader({
  app,
  itemCount,
  totalBytes,
  collapsed,
  allSelected,
  someSelected,
  onToggleCollapsed,
  onToggleAll,
}: {
  app: string;
  itemCount: number;
  totalBytes: number;
  collapsed: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onToggleCollapsed: () => void;
  onToggleAll: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-sm",
        collapsed ? "" : "border-b border-border",
      )}
    >
      <button
        type="button"
        onClick={onToggleAll}
        aria-label={`${allSelected ? "Deselect" : "Select"} all ${itemCount} items for ${app}`}
        className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
      >
        <Checkbox checked={allSelected} indeterminate={someSelected} />
      </button>
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
        aria-expanded={!collapsed}
      >
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-text-muted transition-transform duration-150",
            collapsed && "-rotate-90",
          )}
        />
        <span className="truncate font-medium text-text">{app}</span>
        <span className="text-xs text-text-faint">
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
      </button>
      <span className="shrink-0 text-xs tabular-nums text-text-muted">
        {totalBytes > 0 ? formatBytes(totalBytes) : "—"}
      </span>
    </div>
  );
}

function ScanProgress({ progress }: { progress: number }) {
  const activeIndex = Math.min(
    SCAN_TARGETS.length - 1,
    Math.floor((progress / 100) * SCAN_TARGETS.length),
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Checking {SCAN_TARGETS[activeIndex]} for leftover files</span>
        <span className="tabular-nums text-text-faint">{progress}%</span>
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-surface-active">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="ws-membrane overflow-hidden rounded-lg bg-surface">
        <SkeletonRows count={8} />
      </div>
    </div>
  );
}

function Spotless() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="ws-living-dot mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Check size={20} strokeWidth={2.5} />
      </div>
      <p className="text-sm font-medium text-text">Nothing to clean up</p>
      <p className="mt-1 text-xs text-text-muted">No residual files were left behind. Nice and tidy.</p>
    </div>
  );
}

function NoMatches({ query, categoryFilter }: { query: string; categoryFilter: CategoryFilter }) {
  const hasQuery = query.trim().length > 0;
  const hasCategory = categoryFilter !== "All";
  const body = hasQuery && hasCategory
    ? `Nothing in "${categoryFilter}" matched "${query}".`
    : hasQuery
      ? `Nothing matched "${query}".`
      : `No items in the "${categoryFilter}" category.`;
  return (
    <div className="flex min-h-64 flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-active text-text-muted">
        <FileIcon size={19} strokeWidth={2.5} />
      </div>
      <p className="text-sm font-medium text-text">No orphan files match</p>
      <p className="mt-1 max-w-md text-xs text-text-muted">{body}</p>
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
