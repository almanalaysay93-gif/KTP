import { useEffect, useRef, useState, type MouseEvent } from "react";
import { StatusChip } from "@/components/clay";
import { KtpSignIn, type KtpSignInErrorKind, type KtpSignInStatus } from "@/components/ktp/KtpSignIn";
import { PatientToastRegion, usePatientToast } from "@/components/ktp/patient";
import { cn } from "@/lib/utils";

/** Fictional account for the not-enrolled state. */
const SAMPLE_EMAIL = "sample.patient@gmail.com";

type PreviewState = "idle" | "loading" | "not-enrolled" | "error";
const STATES: { id: PreviewState; label: string }[] = [
  { id: "idle", label: "Idle" },
  { id: "loading", label: "Loading" },
  { id: "not-enrolled", label: "Not enrolled" },
  { id: "error", label: "Error" },
];

function initialState(): PreviewState {
  if (typeof window === "undefined") return "idle";
  const value = new URLSearchParams(window.location.search).get("state");
  return STATES.some((s) => s.id === value) ? (value as PreviewState) : "idle";
}

/**
 * /preview/sign-in: the reusable KtpSignIn with a small state switcher (idle, loading,
 * not enrolled, error). Clicking the Google button runs the loading sequence, then returns to
 * idle with a "Preview only" toast: no Google call is made.
 */
export default function SignInPreview() {
  const [state, setState] = useState<PreviewState>(initialState);
  const [status, setStatus] = useState<KtpSignInStatus>(() => toStatus(initialState()));
  const [forceReduced, setForceReduced] = useState(false);
  const { toast, show, dismiss } = usePatientToast();
  const timers = useRef<number[]>([]);

  useEffect(() => {
    document.title = status === "not-enrolled" ? "Not enrolled | KTP" : "Sign in | KTP";
  }, [status]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const pick = (next: PreviewState) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setState(next);
    setStatus(toStatus(next));
  };

  const runSignIn = () => {
    setState("loading");
    setStatus("signing-in");
    timers.current.push(
      window.setTimeout(() => setStatus("checking"), 1200),
      window.setTimeout(() => {
        setState("idle");
        setStatus("idle");
        show({ tone: "info", title: "Preview only", body: "Sign-in is off in the preview. No Google account was used." });
      }, 2600),
    );
  };

  const previewOnly = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    show({ tone: "info", title: "Preview only", body: "The privacy notice screen is not part of the preview." });
  };

  return (
    <>
      <KtpSignIn
        status={status}
        errorKind={state === "error" ? "network" : (null as KtpSignInErrorKind | null)}
        email={SAMPLE_EMAIL}
        onGoogleSignIn={runSignIn}
        onBackToSignIn={() => pick("idle")}
        onPrivacyClick={previewOnly}
        reducedMotion={forceReduced ? "always" : "user"}
        corner={
          <StatusChip
            status="info"
            label="Sample data"
            size="patient"
            srDetail="fictional account for preview only"
            title="Fictional account for preview only. No real patient data."
          />
        }
        after={
          <aside
            aria-label="Preview controls"
            className="mt-6 flex w-full max-w-[720px] flex-col items-center gap-3 border-t-[1.5px] border-dashed border-line-strong pt-5"
          >
            <p className="type-body-sm text-ink-muted">Preview controls. Not part of the sign-in screen.</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div role="group" aria-label="Sign-in state" className="clay-sunken flex flex-wrap justify-center gap-1 rounded-2xl p-1">
                {STATES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={state === s.id}
                    onClick={() => pick(s.id)}
                    className={cn(
                      "clay-focus type-button h-11 cursor-pointer rounded-xl px-4 transition-colors duration-(--dur-color)",
                      state === s.id ? "clay-1 bg-surface-2 text-ink" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-pressed={forceReduced}
                onClick={() => setForceReduced((f) => !f)}
                className="clay-focus type-button h-11 cursor-pointer rounded-md px-4 text-ink transition-colors duration-(--dur-color) hover:bg-sunken/60"
              >
                {forceReduced ? "Reduced motion: on" : "Reduced motion: follow device"}
              </button>
            </div>
          </aside>
        }
      />
      <PatientToastRegion toast={toast} onDismiss={dismiss} className="bottom-4 lg:bottom-8" />
    </>
  );
}

function toStatus(state: PreviewState): KtpSignInStatus {
  if (state === "loading") return "checking";
  if (state === "not-enrolled") return "not-enrolled";
  return "idle";
}
