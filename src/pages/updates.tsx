import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  Loader2,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import { HeroChip, PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { SkeletonRows } from "../components/ui/skeleton";
import {
  listUpdates,
  listWindowsUpdates,
  openWindowsUpdateSettings,
  updateApp,
} from "../lib/api";
import type { AppUpdate, UpdateStatus, WindowsUpdate } from "../lib/types";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/utils";

export function UpdatesPage() {
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [winUpdates, setWinUpdates] = useState<WindowsUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [winLoading, setWinLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [winError, setWinError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, UpdateStatus>>({});

  async function load() {
    setLoading(true);
    setWinLoading(true);
    setError(null);
    setWinError(null);
    setStatuses({});

    try {
      setUpdates(await listUpdates());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }

    listWindowsUpdates()
      .then((items) => setWinUpdates(items))
      .catch((e) => setWinError(String(e)))
      .finally(() => setWinLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const pending = useMemo(
    () => updates.filter((u) => statuses[u.id] !== "done"),
    [updates, statuses],
  );
  const busy = Object.values(statuses).some((s) => s === "updating");

  const update = useCallback(async (id: string, source: string) => {
    setStatuses((s) => ({ ...s, [id]: "updating" }));
    try {
      await updateApp(id, source);
      setStatuses((s) => ({ ...s, [id]: "done" }));
    } catch {
      setStatuses((s) => ({ ...s, [id]: "failed" }));
    }
  }, []);

  const updateAll = useCallback(async () => {
    for (const u of updates) {
      if (statuses[u.id] === "done" || statuses[u.id] === "updating") continue;
      await update(u.id, u.source);
    }
  }, [updates, statuses, update]);

  const appAllDone = !loading && pending.length === 0;
  const winAllDone = !winLoading && winUpdates.length === 0 && !winError;
  const everythingDone = appAllDone && winAllDone;
  const totalPending = pending.length + winUpdates.length;

  return (
    <>
      <PageHeader
        eyebrow="Maintenance"
        title="Updates"
        subtitle={
          loading || winLoading
            ? "Checking for app updates and Windows Update"
            : everythingDone
              ? "Everything is up to date"
              : `${totalPending} update${totalPending === 1 ? "" : "s"} available`
        }
        hero={{
          metric: loading && winLoading ? "--" : totalPending.toString(),
          label: "Outdated · Winget + Windows Update",
          chips: (
            <>
              <HeroChip>
                {loading ? "Scanning" : `${pending.length} app${pending.length === 1 ? "" : "s"}`}
              </HeroChip>
              <HeroChip>
                {winLoading
                  ? "Scanning system"
                  : `${winUpdates.length} system${winUpdates.length === 1 ? "" : "s"}`}
              </HeroChip>
              {!loading && (
                <HeroChip>
                  {updates.filter((u) => u.source.toLowerCase() === "msstore").length} store
                </HeroChip>
              )}
            </>
          ),
        }}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={load} disabled={loading || winLoading || busy}>
              <RotateCw
                size={15}
                className={loading || winLoading ? "animate-spin" : undefined}
              />
              Check again
            </Button>
            {!loading && !appAllDone && (
              <Button variant="primary" onClick={updateAll} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Update all apps
              </Button>
            )}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 pb-8">
        {error && <ErrorBanner message={error} />}

        <Section
          title="Apps"
          subtitle="winget and Microsoft Store"
        >
          {loading ? (
            <div className="ws-membrane overflow-hidden rounded-lg bg-surface">
              <SkeletonRows count={6} />
            </div>
          ) : appAllDone ? (
            <Settled label="All apps are up to date" />
          ) : (
            <ul className="ws-membrane overflow-hidden rounded-lg bg-surface">
              {updates.map((u, i) => (
                <UpdateRow
                  key={u.id}
                  update={u}
                  status={statuses[u.id] ?? "idle"}
                  divided={i > 0}
                  index={i}
                  onUpdate={() => update(u.id, u.source)}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Windows Update"
          subtitle="System and security updates"
          action={
            !winLoading && winUpdates.length > 0 ? (
              <Button variant="primary" size="sm" onClick={openWindowsUpdateSettings}>
                <ExternalLink size={14} />
                Open Windows Settings
              </Button>
            ) : null
          }
        >
          {winLoading ? (
            <div className="ws-membrane overflow-hidden rounded-lg bg-surface">
              <SkeletonRows count={3} />
            </div>
          ) : winError ? (
            <ErrorBanner message={winError} />
          ) : winUpdates.length === 0 ? (
            <Settled label="Windows is up to date" />
          ) : (
            <>
              <p className="mb-3 text-xs text-text-muted">
                Windows Update is installed by the operating system. Use the button above to
                review and install these in Windows Settings.
              </p>
              <ul className="ws-membrane overflow-hidden rounded-lg bg-surface">
                {winUpdates.map((u, i) => (
                  <WindowsUpdateRow key={u.id} update={u} divided={i > 0} index={i} />
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function UpdateRow({
  update,
  status,
  divided,
  index,
  onUpdate,
}: {
  update: AppUpdate;
  status: UpdateStatus;
  divided: boolean;
  index: number;
  onUpdate: () => void;
}) {
  const updating = status === "updating";

  return (
    <li
      style={{ "--i": index } as CSSProperties}
      className={cn(
        "ws-row ws-vein relative flex items-center gap-6 px-4 py-3 transition-colors duration-150",
        status !== "done" && "hover:bg-surface-hover",
        divided && "border-t border-border",
        status === "done" && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text">{update.name}</span>
          {update.source.toLowerCase() === "msstore" && <SourceBadge label="Store" />}
        </div>
        <div className="truncate text-xs text-text-muted">{update.publisher}</div>
      </div>

      <div className="hidden items-center gap-2 text-xs tabular-nums text-text-muted sm:flex">
        <span>v{update.currentVersion || "?"}</span>
        <ArrowRight size={13} className="text-text-faint" />
        <span className="font-medium text-text">v{update.availableVersion}</span>
      </div>

      <div className="flex w-32 shrink-0 justify-end">
        {status === "done" ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-success">
            <Check size={15} />
            Updated
          </span>
        ) : status === "failed" ? (
          <Button variant="default" size="sm" onClick={onUpdate} className="text-danger">
            <RotateCw size={14} />
            Retry
          </Button>
        ) : (
          <Button variant="default" size="sm" onClick={onUpdate} disabled={updating}>
            {updating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Updating
              </>
            ) : (
              "Update"
            )}
          </Button>
        )}
      </div>

      {updating && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
          <span className="block h-full w-1/3 animate-[ws-indeterminate_1.2s_ease-in-out_infinite] bg-accent" />
        </span>
      )}
    </li>
  );
}

function WindowsUpdateRow({
  update,
  divided,
  index,
}: {
  update: WindowsUpdate;
  divided: boolean;
  index: number;
}) {
  return (
    <li
      style={{ "--i": index } as CSSProperties}
      className={cn(
        "ws-row ws-vein flex items-center gap-6 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover",
        divided && "border-t border-border",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-active text-text-muted">
        <ShieldCheck size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{update.title}</div>
        <div className="flex items-center gap-2 truncate text-xs text-text-muted">
          {update.kb && <span className="font-mono">{update.kb}</span>}
          {update.severity && (
            <>
              {update.kb && <span className="text-text-faint">·</span>}
              <span>{update.severity}</span>
            </>
          )}
        </div>
      </div>
      <div className="w-20 shrink-0 text-left text-xs tabular-nums text-text-muted">
        {update.sizeBytes > 0 ? formatBytes(update.sizeBytes) : "--"}
      </div>
    </li>
  );
}

function SourceBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
      {label}
    </span>
  );
}

function Settled({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-4 text-sm text-text-muted">
      <div className="ws-living-dot flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Check size={15} strokeWidth={2.5} />
      </div>
      <span>{label}</span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}
