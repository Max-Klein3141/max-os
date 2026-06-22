import { X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Card } from "./ui/Card";

/**
 * A small amber "this is still open today" banner, shown at the top of a tab
 * when its daily ritual hasn't been done yet. Pair it with an optional action,
 * and an optional dismiss handler (renders an ✕).
 */
export function ReminderBanner({
  icon: Icon,
  children,
  action,
  onDismiss,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <Card className="flex items-center gap-3 border-amber-400/30 bg-amber-400/5 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
        <Icon size={17} />
      </span>
      <p className="flex-1 text-sm text-amber-100/90">{children}</p>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1.5 text-amber-200/50 transition-colors hover:bg-amber-400/10 hover:text-amber-100"
        >
          <X size={15} />
        </button>
      )}
    </Card>
  );
}
