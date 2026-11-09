import { useEffect, useRef, useState, type FormEvent } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { ClayButton } from "@/components/clay/ClayButton";
import { ClayCard } from "@/components/clay/ClayCard";
import { ClayInput } from "@/components/clay/ClayInput";

export default function SignInPage() {
  const { user, loading } = useAuth();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [statusAttempt, setStatusAttempt] = useState(0);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitPending = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Sign In | KTP";
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setSetupRequired(null);
    setStatusError(null);
    async function loadStatus() {
      try {
        const response = await fetch("/api/local-auth/status", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Status unavailable");
        const data: unknown = await response.json();
        if (
          !data ||
          typeof data !== "object" ||
          !("setupRequired" in data) ||
          typeof data.setupRequired !== "boolean"
        ) {
          throw new Error("Invalid status");
        }
        if (active) setSetupRequired(data.setupRequired);
      } catch {
        if (active)
          setStatusError("We couldn’t check local sign-in. Please try again.");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void loadStatus();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [statusAttempt]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitPending.current || setupRequired === null || loading) return;
    setError(null);
    const submittedPassword = password;
    const confirmed = password === confirmation;
    setPassword("");
    setConfirmation("");
    if (
      submittedPassword.length < (setupRequired ? 12 : 1) ||
      submittedPassword.length > 128
    ) {
      setError(
        setupRequired
          ? "Choose a password between 12 and 128 characters."
          : "Enter your password to continue."
      );
      return;
    }
    if (setupRequired && !confirmed) {
      setError("The passwords don’t match. Enter them again.");
      return;
    }
    submitPending.current = true;
    setSubmitting(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(
        setupRequired ? "/api/local-auth/setup" : "/api/local-auth/login",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: submittedPassword }),
          signal: controller.signal,
        }
      );
      if (response.ok) {
        window.location.assign("/dashboard");
        return;
      }
      if (response.status === 429) {
        setError("Too many attempts. Wait a moment, then try again.");
      } else if (response.status === 409 && setupRequired) {
        setSetupRequired(false);
        setError("Setup is already complete. Sign in with your password.");
      } else if (response.status === 401) {
        setError("That password was not accepted. Please try again.");
      } else {
        setError("Sign-in could not be completed. Please try again.");
      }
    } catch {
      setError("We couldn’t reach local sign-in. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      submitPending.current = false;
      setSubmitting(false);
    }
  }

  if (!loading && user)
    return <Redirect to={user.isAdmin ? "/dashboard" : "/me"} />;
  const checking = loading || setupRequired === null;
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-ground px-4 py-10 text-ink sm:px-6"
      aria-label="Local sign in"
    >
      <div className="w-full max-w-[960px]">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="mx-auto max-w-sm text-center lg:text-left">
            <img
              src="/branding/ots-logo.png"
              alt="Organ Transplant Services"
              width={478}
              height={177}
              className="mx-auto mb-6 w-56 mix-blend-multiply lg:mx-0"
            />
            <p className="type-caption mb-3 font-semibold uppercase tracking-widest text-ink-muted">
              Kidney Transplant Program
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              Care coordination,
              <br />
              close at hand.
            </h1>
            <p className="type-body mt-4 text-ink-muted">
              Your patient records, laboratory results, and follow-up plans in
              one workspace.
            </p>
          </div>
          <ClayCard surface={2} level={3} className="w-full p-6 sm:p-8">
            <div className="clay-sunken mb-5 inline-flex items-center gap-2 rounded-full px-3 py-2 type-caption text-ink-muted">
              <ShieldCheck className="size-4" aria-hidden /> Local workspace
            </div>
            <h2 className="type-title text-2xl">
              {setupRequired ? "Set up KTP" : "Welcome back"}
            </h2>
            <p className="type-body-sm mt-2 text-ink-muted">
              {setupRequired
                ? "Create a password for this KTP workspace. You’ll use it each time you sign in."
                : "Enter your password to open your KTP workspace."}
            </p>
            {statusError ? (
              <div className="mt-6 space-y-4">
                <p role="alert" className="type-body-sm text-overdue">
                  {statusError}
                </p>
                <ClayButton
                  variant="secondary"
                  className="w-full"
                  onClick={() => setStatusAttempt(attempt => attempt + 1)}
                >
                  Try again
                </ClayButton>
              </div>
            ) : checking ? (
              <p role="status" className="type-body-sm py-8 text-ink-muted">
                Checking local sign-in…
              </p>
            ) : (
              <form
                className="mt-6 space-y-5"
                onSubmit={submit}
                noValidate
                aria-busy={submitting}
              >
                {error ? (
                  <div
                    id="local-auth-error"
                    ref={errorRef}
                    tabIndex={-1}
                    role="alert"
                    className="clay-focus rounded-md border border-overdue p-3 type-body-sm text-overdue"
                  >
                    {error}
                  </div>
                ) : null}
                <ClayInput
                  id="local-password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete={
                    setupRequired ? "new-password" : "current-password"
                  }
                  minLength={setupRequired ? 12 : 1}
                  maxLength={128}
                  required
                  disabled={submitting}
                  leading={<LockKeyhole />}
                  aria-describedby={error ? "local-auth-error" : undefined}
                  aria-invalid={error ? true : undefined}
                  hint={
                    setupRequired
                      ? "Use 12–128 characters. A longer, memorable passphrase works well."
                      : undefined
                  }
                />
                {setupRequired ? (
                  <ClayInput
                    id="local-password-confirmation"
                    label="Confirm password"
                    type="password"
                    value={confirmation}
                    onChange={event => setConfirmation(event.target.value)}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    disabled={submitting}
                    aria-describedby={error ? "local-auth-error" : undefined}
                    aria-invalid={error ? true : undefined}
                  />
                ) : null}
                <ClayButton
                  type="submit"
                  className="w-full"
                  loading={submitting}
                  disabled={submitting}
                >
                  {submitting
                    ? setupRequired
                      ? "Creating password…"
                      : "Signing in…"
                    : setupRequired
                      ? "Create local password"
                      : "Sign in"}
                </ClayButton>
              </form>
            )}
            <p className="type-caption mt-6 border-t border-hairline pt-5 text-ink-muted">
              Access is protected by your local workspace password.
            </p>
          </ClayCard>
        </div>
        <p className="type-caption mt-8 text-center text-ink-muted">
          Organ Transplant Services. Established 2017.
        </p>
      </div>
    </main>
  );
}
