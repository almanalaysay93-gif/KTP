import * as React from "react";
import { cn } from "@/lib/utils";
import { ClayCell, type ClayCellProps } from "./ClayCell";

export type StatTileProps = ClayCellProps;

/**
 * A single clay stat outside a tray (same anatomy as a tray cell).
 * Static by default; becomes a link with href or a button with onClick.
 */
export const StatTile = React.forwardRef<HTMLElement, StatTileProps>(function StatTile(
  { as, href, onClick, className, ...rest },
  ref,
) {
  const tag = as ?? (href ? "a" : onClick ? "button" : "div");
  return <ClayCell ref={ref} as={tag} href={href} onClick={onClick} className={cn(className)} {...rest} />;
});
