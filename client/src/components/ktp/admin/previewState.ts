import { useCallback, useState } from "react";

/*
 * Preview-only state switch, so every region can be reviewed in its loading, error, and empty forms
 * without a backend: add `?state=loading`, `?state=error`, or `?state=empty` to a preview URL.
 * Retry returns a region to "ready".
 */

export type PreviewState = "ready" | "loading" | "error" | "empty";

const STATES: readonly PreviewState[] = ["ready", "loading", "error", "empty"];

function readState(): PreviewState {
  if (typeof window === "undefined") return "ready";
  const value = new URLSearchParams(window.location.search).get("state");
  return STATES.includes(value as PreviewState) ? (value as PreviewState) : "ready";
}

export function usePreviewState(): [PreviewState, () => void] {
  const [state, setState] = useState<PreviewState>(readState);
  const retry = useCallback(() => setState("ready"), []);
  return [state, retry];
}
