import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** Surface card — subtle border, faint fill. Padding is applied by callers. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800 bg-zinc-900/50 shadow-sm",
        className,
      )}
      {...rest}
    />
  );
}
