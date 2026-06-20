import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface TagProps {
  children: ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export function Tag({ children, onRemove, onClick, active, className }: TagProps) {
  const interactive = Boolean(onClick);
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-200"
          : "border-zinc-700 bg-zinc-800/60 text-zinc-300",
        interactive && "cursor-pointer hover:border-zinc-600 hover:text-white",
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-1 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-white"
          aria-label="Remove tag"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}
