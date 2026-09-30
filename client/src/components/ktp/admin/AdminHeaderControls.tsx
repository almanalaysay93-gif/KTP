import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Small header controls shared by admin pages: the patient search (focus with "/") and the
 * notification bell with its ink badge and peach Mono numeral (unread is not an alarm, so not red).
 */

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, className },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <label htmlFor="admin-search" className="sr-only">
        Search patients by name or HRN
      </label>
      <Search aria-hidden strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
      <input
        ref={inputRef}
        id="admin-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name or HRN"
        aria-keyshortcuts="/"
        autoComplete="off"
        className="clay-sunken clay-focus type-body h-11 w-full rounded-full border-[1.5px] border-line-strong pl-11 pr-11 text-ink transition-colors duration-(--dur-color) placeholder:text-ink-muted hover:border-ink focus-visible:border-ink"
      />
      <kbd
        aria-hidden
        className="type-data pointer-events-none absolute right-3 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-xs bg-surface-2 text-ink-muted clay-1"
      >
        /
      </kbd>
    </div>
  );
});

export function BellButton({ count, onClick, className }: { count: number; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`Notifications, ${count} new`}
      onClick={onClick}
      className={cn(
        "clay-1 clay-hover clay-press clay-focus relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md bg-surface-2 text-ink",
        className,
      )}
    >
      <Bell aria-hidden className="size-5" strokeWidth={1.75} />
      {count > 0 ? (
        <span
          aria-hidden
          className="type-label absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 font-mono text-peach"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
