import type { MouseEventHandler } from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmergencyBandProps {
  /** `appSettings.emergencyHotlineText`, shown after the word "call". Blank drops the call clause. */
  hotlineText?: string | null;
  /** Digits for the tel: link. Without it there is no Call button. */
  hotlineTel?: string | null;
  /** Preview hook: intercept the call (for example to show "Preview only"). */
  onCall?: MouseEventHandler<HTMLAnchorElement>;
  className?: string;
}

/**
 * The emergency band (DESIGN.md Components). Static by contract: no motion component, no hover
 * lift, no transition, never part of an entrance. A labelled aside, not a live region.
 * Maroon ground, so the focus ring switches to peach (clay-on-dark).
 */
export function EmergencyBand({ hotlineText, hotlineTel, onCall, className }: EmergencyBandProps) {
  const hotline = hotlineText?.trim();
  return (
    <aside
      aria-label="Emergency information"
      data-static="true"
      className={cn(
        "clay-on-dark flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-maroon px-4 py-4 text-emergency-ink sm:px-5",
        className,
      )}
    >
      <p className="type-body-lg flex min-w-0 flex-[1_1_16rem] items-start gap-3">
        <Phone aria-hidden className="mt-1 size-5 shrink-0" strokeWidth={1.75} />
        <span>
          {hotline ? (
            <>
              In an emergency, call <strong className="font-bold">{hotline}</strong> or go to the nearest emergency room.
            </>
          ) : (
            "In an emergency, go to the nearest emergency room."
          )}
        </span>
      </p>
      {hotline && hotlineTel ? (
        <a
          href={`tel:${hotlineTel}`}
          onClick={onCall}
          aria-label={`Call ${hotline}`}
          className="clay-1 clay-press clay-focus type-button inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-surface-2 px-5 text-maroon no-underline [&_svg]:size-5"
        >
          <Phone aria-hidden strokeWidth={1.75} />
          Call
        </a>
      ) : null}
    </aside>
  );
}
