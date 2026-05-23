import { useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, Save, ShieldAlert } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { getLastScheduledRun, getSchedule, setSchedule } from "../lib/api";
import type { ScheduleConfig } from "../lib/types";
import { cn } from "../lib/utils";

const DAYS: ScheduleConfig["dayOfWeek"][] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_LABEL: Record<ScheduleConfig["dayOfWeek"], string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

export function SettingsPage() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSchedule(), getLastScheduledRun()])
      .then(([cfg, last]) => {
        if (!cancelled) {
          setConfig(cfg);
          setLastRun(last);
        }
      })
      .catch((e) => !cancelled && setStatus({ kind: "err", message: String(e) }));
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    setStatus(null);
    try {
      const result = await setSchedule(config);
      setStatus({ kind: result.success ? "ok" : "err", message: result.message });
    } catch (e) {
      setStatus({ kind: "err", message: String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <>
        <PageHeader eyebrow="Preferences" title="Settings" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      </>
    );
  }

  const noTargetsSelected =
    !config.cleanTemp && !config.cleanRecycleBin && !config.cleanCaches;

  return (
    <>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Schedule unattended cleanup and manage WinSweep's behavior."
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 pb-8">
        {/* Schedule card */}
        <section className="rounded-lg border border-border bg-surface">
          <header className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">
                <CalendarClock size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text">Weekly cleanup</h2>
                <p className="text-xs text-text-muted">
                  WinSweep runs in the background at the time you choose.
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={config.enabled}
              onChange={(enabled) => setConfig({ ...config, enabled })}
            />
          </header>

          <div className={cn("border-t border-border px-5 py-5", !config.enabled && "opacity-55")}>
            <fieldset disabled={!config.enabled} className="space-y-5">
              {/* Day picker */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Day of the week
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setConfig({ ...config, dayOfWeek: day })}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        config.dayOfWeek === day
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-surface text-text-muted hover:border-accent/40 hover:text-text",
                      )}
                    >
                      {DAY_LABEL[day]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time picker */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Time
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <NumberInput
                    value={config.hour}
                    min={0}
                    max={23}
                    onChange={(hour) => setConfig({ ...config, hour })}
                    aria-label="Hour"
                  />
                  <span className="text-text-muted">:</span>
                  <NumberInput
                    value={config.minute}
                    min={0}
                    max={59}
                    onChange={(minute) => setConfig({ ...config, minute })}
                    aria-label="Minute"
                  />
                  <span className="ml-2 text-xs text-text-faint">24-hour, local time</span>
                </div>
              </div>

              {/* What to clean */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  What to clean
                </label>
                <div className="mt-2 space-y-2">
                  <CheckRow
                    label="Temporary files"
                    description="Everything under %TEMP%."
                    checked={config.cleanTemp}
                    onChange={(cleanTemp) => setConfig({ ...config, cleanTemp })}
                  />
                  <CheckRow
                    label="Recycle Bin"
                    description="Permanently delete items currently in the bin."
                    checked={config.cleanRecycleBin}
                    onChange={(cleanRecycleBin) =>
                      setConfig({ ...config, cleanRecycleBin })
                    }
                  />
                  <CheckRow
                    label="App caches"
                    description="Folders named Cache / Caches under LocalAppData."
                    checked={config.cleanCaches}
                    onChange={(cleanCaches) => setConfig({ ...config, cleanCaches })}
                  />
                </div>
                {config.enabled && noTargetsSelected && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-warning">
                    <ShieldAlert size={13} />
                    Pick at least one category, otherwise the task will do nothing.
                  </p>
                )}
              </div>
            </fieldset>

            {lastRun && (
              <p className="mt-5 border-t border-border pt-4 text-xs text-text-muted">
                Last ran: <span className="font-mono">{lastRun}</span>
              </p>
            )}
          </div>

          <footer className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
            <div className="min-w-0 text-xs">
              {status ? (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    status.kind === "ok" ? "text-success" : "text-danger",
                  )}
                >
                  {status.kind === "ok" ? <Check size={14} /> : <ShieldAlert size={14} />}
                  <span className="truncate">{status.message}</span>
                </span>
              ) : (
                <span className="text-text-faint">
                  Changes register a Windows Scheduled Task via schtasks.
                </span>
              )}
            </div>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save schedule
            </Button>
          </footer>
        </section>

        {/* Placeholder for future settings */}
        <p className="text-center text-xs text-text-faint">
          More preferences coming soon: theme overrides, ignore-list management, telemetry.
        </p>
      </div>
    </>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked ? "border-accent bg-accent" : "border-border bg-surface-active",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-surface shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
  ...rest
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
} & React.AriaAttributes) {
  return (
    <input
      type="number"
      value={String(value).padStart(2, "0")}
      min={min}
      max={max}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n)) {
          onChange(Math.max(min, Math.min(max, n)));
        }
      }}
      className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 text-center font-mono text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      {...rest}
    />
  );
}

function CheckRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent/40"
    >
      <div className="mt-0.5">
        <Checkbox checked={checked} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text">{label}</div>
        <div className="text-xs text-text-muted">{description}</div>
      </div>
    </button>
  );
}
