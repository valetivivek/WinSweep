import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Check,
  Database,
  Eye,
  EyeOff,
  File as FileIcon,
  Folder,
  Loader2,
  RotateCw,
  Trash2,
} from "lucide-react";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { SearchInput } from "../components/ui/search-input";
import {
  addIgnored,
  clearIgnored,
  deleteResiduals,
  listIgnored,
  scanResiduals,
} from "../lib/api";
import type { ResidualItem, ResidualKind, ResidualLocation } from "../lib/types";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/utils";

type ScanState = "scanning" | "results";

const SCAN_TARGETS: ResidualLocation[] = [
  "AppData",
  "LocalAppData",
  "ProgramData",
  "Temp",
  "Registry",
];

const KIND_ICON: Record<ResidualKind, typeof Folder> = {
  folder: Folder,
  file: FileIcon,
  registry: Database,
};

export function CleanupPage() {
  const [state, setState] = useState<ScanState>("scanning");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResidualItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
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

  const visibleResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results;
    const terms = q.split(/\s+/).filter(Boolean);
    return results.filter((item) => {
      const fileName = residualName(item.path);
      const extension = residualExtension(fileName);
      const searchable = [
        item.relatedTo,
        item.kind,
        item.location,
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
  }, [query, results]);

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
                  results.reduce((sum, r) => sum + r.sizeBytes, 0),
                )} reclaimable`
        }
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
          <Scanning progress={progress} />
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
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-faint">
                <span>
                  {query
                    ? `${visibleResults.length} of ${results.length} orphan item${
                        results.length === 1 ? "" : "s"
                      } shown`
                    : `${results.length} orphan item${results.length === 1 ? "" : "s"} shown`}
                </span>
                {hiddenSelectedCount > 0 && (
                  <span className="rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-warning">
                    {hiddenSelectedCount} selected outside this search
                  </span>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {visibleResults.length === 0 ? (
                <NoMatches query={query} />
              ) : (
                <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                  {visibleResults.map((item, i) => (
                    <ResidualRow
                      key={item.id}
                      item={item}
                      checked={selected.has(item.id)}
                      divided={i > 0}
                      index={i}
                      onToggle={() => toggle(item.id)}
                      onIgnore={() => ignore(item)}
                    />
                  ))}
                </ul>
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
        "ws-row group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40",
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
      <LocationBadge location={item.location} />
      <div className="w-16 shrink-0 text-right text-xs tabular-nums text-text-muted">
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
        className="shrink-0 rounded p-1 text-text-faint opacity-0 transition-[opacity,color] duration-150 hover:text-text group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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

function Scanning({ progress }: { progress: number }) {
  const activeIndex = Math.min(
    SCAN_TARGETS.length - 1,
    Math.floor((progress / 100) * SCAN_TARGETS.length),
  );
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <Loader2 size={28} className="animate-spin text-accent" />
      <p className="mt-5 text-sm font-medium text-text">Scanning your system</p>
      <p className="mt-1 text-xs text-text-muted">
        Checking {SCAN_TARGETS[activeIndex]} for leftover files
      </p>
      <div className="mt-6 h-1 w-64 overflow-hidden rounded-full bg-surface-active">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function Spotless() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Check size={22} strokeWidth={2.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-text">Nothing to clean up</p>
      <p className="mt-1 text-xs text-text-muted">No residual files were left behind. Nice and tidy.</p>
    </div>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-active text-text-muted">
        <FileIcon size={21} strokeWidth={2.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-text">No orphan files match</p>
      <p className="mt-1 max-w-md text-xs text-text-muted">
        Nothing matched "{query}". Search checks file name, path, extension, location, kind, size,
        and related app metadata.
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
