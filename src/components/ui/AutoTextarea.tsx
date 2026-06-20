import { useEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/** Textarea that grows to fit its content (no inner scrollbar, no drag handle). */
export function AutoTextarea({
  value,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      className={cn("block w-full overflow-hidden", className)}
      {...rest}
    />
  );
}
