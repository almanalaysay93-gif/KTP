import * as React from "react";
import { cn } from "@/lib/utils";
import { ClayCell } from "./ClayCell";

export interface ClayTrayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "3x3" is the Nine-Cell Tray (one per screen). "1x3" is the patient strip, 3 columns at every width. */
  layout?: "3x3" | "1x3";
  /** 3x3 only. true (default): 2 columns under 1024 with the center cell spanning both. false: 3 columns always. */
  reflow?: boolean;
  /** Accessible name for the group, for example "Triage counts". */
  label: string;
  /** One tab stop, arrow keys move between cells. Defaults to true for 3x3. */
  roving?: boolean;
  /** Renders sunken skeleton cells and marks the group busy. */
  loading?: boolean;
  loadingLabel?: string;
}

const CELL_SELECTOR = "a[data-tray-cell][href], button[data-tray-cell]:not(:disabled)";

function getCells(root: HTMLElement | null) {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(CELL_SELECTOR)) : [];
}

/** Nearest cell in the next row up or down, by geometry, so it works for 2 and 3 columns. */
function verticalNeighbor(cells: HTMLElement[], index: number, dir: 1 | -1) {
  const from = cells[index].getBoundingClientRect();
  const fromX = from.left + from.width / 2;
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  cells.forEach((cell, i) => {
    if (i === index) return;
    const box = cell.getBoundingClientRect();
    const dy = dir === 1 ? box.top - from.bottom : from.top - box.bottom;
    if (dy < -1) return;
    const toX = Math.max(box.left, Math.min(fromX, box.right));
    const score = dy * 1000 + Math.abs(toX - fromX);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export const ClayTray = React.forwardRef<HTMLDivElement, ClayTrayProps>(function ClayTray(
  {
    layout = "3x3",
    reflow = true,
    label,
    roving,
    loading = false,
    loadingLabel = "Loading",
    className,
    children,
    onKeyDown,
    onFocus,
    ...rest
  },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLDivElement);
  const isRoving = (roving ?? layout === "3x3") && !loading;

  const setActive = React.useCallback((active: HTMLElement | undefined) => {
    const cells = getCells(innerRef.current);
    const target = active ?? cells[0];
    cells.forEach((cell) => {
      cell.tabIndex = cell === target ? 0 : -1;
    });
  }, []);

  // Keep exactly one tab stop: the selected cell, else the first.
  React.useLayoutEffect(() => {
    if (!isRoving) return;
    const cells = getCells(innerRef.current);
    if (cells.some((cell) => cell.tabIndex === 0 && cell.contains(document.activeElement))) return;
    setActive(cells.find((cell) => cell.dataset.selected === "true"));
  });

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    if (!isRoving) return;
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-tray-cell]");
    if (cell) setActive(cell);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !isRoving) return;
    const cells = getCells(innerRef.current);
    const index = cells.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    let next = -1;
    switch (event.key) {
      case "ArrowRight":
        next = Math.min(index + 1, cells.length - 1);
        break;
      case "ArrowLeft":
        next = Math.max(index - 1, 0);
        break;
      case "ArrowDown":
        next = verticalNeighbor(cells, index, 1);
        break;
      case "ArrowUp":
        next = verticalNeighbor(cells, index, -1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = cells.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next >= 0 && next !== index) {
      setActive(cells[next]);
      cells[next].focus();
    }
  };

  const skeletonCount = layout === "3x3" ? 9 : 3;

  return (
    <div
      ref={innerRef}
      role="group"
      aria-label={label}
      aria-busy={loading || undefined}
      data-layout={layout}
      data-reflow={layout === "3x3" && reflow ? "true" : undefined}
      className={cn("clay-tray", className)}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      {...rest}
    >
      {loading ? (
        <>
          <span className="sr-only">{loadingLabel}</span>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <ClayCell key={i} state="loading" center={layout === "3x3" && i === 4} />
          ))}
        </>
      ) : (
        children
      )}
    </div>
  );
});
