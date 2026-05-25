import { cn } from "../../lib/utils";

type Variant = "line" | "chip" | "row";

interface SkeletonProps {
  variant?: Variant;
  className?: string;
  width?: string;
}

export function Skeleton({ variant = "line", className, width }: SkeletonProps) {
  if (variant === "row") {
    return (
      <div className={cn("flex items-center gap-3 px-4 py-3", className)}>
        <div className="ws-skeleton h-9 w-9 shrink-0" style={{ borderRadius: "28%" }} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="ws-skeleton h-3 w-1/2" />
          <div className="ws-skeleton h-2.5 w-1/3" />
        </div>
        <div className="ws-skeleton hidden h-3 w-20 sm:block" />
        <div className="ws-skeleton h-3 w-12" />
      </div>
    );
  }
  if (variant === "chip") {
    return (
      <div
        className={cn("ws-skeleton h-5", className)}
        style={{ width: width ?? "72px", borderRadius: 9999 }}
      />
    );
  }
  return (
    <div
      className={cn("ws-skeleton h-3", className)}
      style={{ width: width ?? "100%" }}
    />
  );
}

export function SkeletonRows({ count }: { count: number }) {
  return (
    <ul>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className={i > 0 ? "border-t border-border" : undefined}>
          <Skeleton variant="row" />
        </li>
      ))}
    </ul>
  );
}
