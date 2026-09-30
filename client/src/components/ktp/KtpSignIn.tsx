import { useEffect, useId, useRef, useState, type MouseEventHandler, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronDown, LogIn, Undo2 } from "lucide-react";
import { ClayCardError } from "@/components/clay";
import {
  AnimatePresence, Entrance, MotionClayButton, MotionRoot, OrganGridBackdrop, useMotionPreset,
} from "@/components/motion";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "./patient/PatientNav";
import { GoogleButton } from "./signin/GoogleButton";
import { LogoTray } from "./signin/LogoTray";

/** Where the sign-in stands. "signing-in" is the Google popup; "checking" is the enrollment lookup. */
export type KtpSignInStatus = "idle" | "signing-in" | "checking" | "not-enrolled";
export type KtpSignInErrorKind = "cancelled" | "network" | "generic";

export interface KtpSignInProps {
  status?: KtpSignInStatus;
  /** Shown above the Google button while idle (spec 8, COPY.md signin.error). */
  errorKind?: KtpSignInErrorKind | null;
  /** The Google account that is not enrolled. Falls back to "this Google account". */
  email?: string | null;
  onGoogleSignIn: () => void;
  /** Not enrolled: pick a different Google account. Defaults to onGoogleSignIn. */
  onUseAnotherAccount?: () => void;
  onBackToSignIn?: () => void;
  /** The privacy notice (consent screen, spec 4). */
  privacyHref?: string;
  onPrivacyClick?: MouseEventHandler<HTMLAnchorElement>;
  /** Top-right slot, outside the card (the preview "Sample data" badge). */
  corner?: ReactNode;
  /** Rendered after the footer (preview controls). */
  after?: ReactNode;
  /** Force reduced motion (a preview toggle). OS reduced motion always wins. */
  reducedMotion?: "user" | "always";
}

const ERRORS: Record<KtpSignInErrorKind, string> = {
  cancelled: "Sign-in was closed before it finished. Try again when you are ready.",
  network: "We could not reach Google. Check your internet, then try again.",
  generic: "Sign-in did not go through. Please try again.",
};

/**
 * KTP sign-in (DESIGN.md Screen 1, COPY.md section 1). Eye path: the logo tray, the wordmark,
 * the Google button. Phones stack wordmark, tray, then copy with no card and fit 390 x 844;
 * from 1024 the tray sits left of a raised card. Wide fine-pointer screens get the admin-level
 * assembly and the organ-grid backdrop (the 1440 wireframe lists it); phones stay calm and light.
 */
export function KtpSignIn(props: KtpSignInProps) {
  const wide = useMediaQuery("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
  return (
    <MotionRoot intensity={wide ? "full" : "lively"} reducedMotion={props.reducedMotion}>
      <SignInLayout {...props} />
    </MotionRoot>
  );
}

function SignInLayout({ corner, after, ...props }: KtpSignInProps) {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-ground text-ink">
      <OrganGridBackdrop />
      {corner ? <div className="absolute right-3 top-3 z-10 sm:right-6 sm:top-6">{corner}</div> : null}
      <main
        aria-label="Sign in"
        className="mx-auto flex min-h-dvh w-full max-w-[1120px] flex-col items-center justify-center gap-5 px-4 pb-6 pt-4 sm:px-6 lg:gap-8 lg:px-8 lg:py-12"
      >
        <div className="flex w-full flex-col items-center gap-5 lg:flex-row lg:items-center lg:justify-center lg:gap-16">
          <LogoTray className="order-2 max-w-[280px] min-[400px]:max-w-[300px] md:max-w-[360px] lg:order-none lg:w-[min(460px,calc(100vw-620px))] lg:max-w-none" />
          <Entrance className="contents lg:block lg:w-[440px] lg:shrink-0">
            <div className="contents lg:flex lg:flex-col lg:gap-6 lg:rounded-2xl lg:bg-surface-2 lg:p-10 lg:shadow-(--clay-3)">
              <Wordmark className="order-1 lg:order-none" />
              <CardBody {...props} />
            </div>
          </Entrance>
        </div>
        <p className="type-caption text-ink-muted">Organ Transplant Services. Established 2017.</p>
        {after}
      </main>
    </div>
  );
}

/** The wordmark half of the OTS logo (the mark is the tray), cropped from the full logo file. */
function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("relative aspect-[309/177] h-14 shrink-0 self-center overflow-hidden lg:h-20 lg:self-start", className)}>
      <img
        src="/branding/ots-logo.png"
        alt="Organ Transplant Services, established 2017"
        width={478}
        height={177}
        decoding="async"
        className="absolute inset-y-0 right-0 h-full w-auto max-w-none mix-blend-multiply"
      />
    </div>
  );
}

function CardBody({
  status = "idle",
  errorKind,
  email,
  onGoogleSignIn,
  onUseAnotherAccount,
  onBackToSignIn,
  privacyHref = "#privacy-notice",
  onPrivacyClick,
}: Omit<KtpSignInProps, "corner" | "after" | "reducedMotion">) {
  const preset = useMotionPreset();
  const notEnrolled = status === "not-enrolled";
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: preset.reduced ? 0.15 : 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  };
  return (
    <div className="order-3 w-full max-w-[440px] lg:order-none">
      <AnimatePresence mode="wait" initial={false}>
        {notEnrolled ? (
          <motion.div key="not-enrolled" {...fade}>
            <NotEnrolled
              email={email}
              onUseAnotherAccount={onUseAnotherAccount ?? onGoogleSignIn}
              onBackToSignIn={onBackToSignIn}
            />
          </motion.div>
        ) : (
          <motion.div key="sign-in" {...fade}>
            <SignInForm
              status={status}
              errorKind={errorKind}
              onGoogleSignIn={onGoogleSignIn}
              privacyHref={privacyHref}
              onPrivacyClick={onPrivacyClick}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SignInForm({
  status,
  errorKind,
  onGoogleSignIn,
  privacyHref,
  onPrivacyClick,
}: Pick<KtpSignInProps, "status" | "errorKind" | "onGoogleSignIn" | "privacyHref" | "onPrivacyClick">) {
  const whyId = useId();
  const [whyOpen, setWhyOpen] = useState(false);
  const busy = status === "signing-in" || status === "checking";
  const busyLabel = status === "checking" ? "Checking your enrollment..." : "Signing you in...";
  return (
    <div className="flex flex-col gap-4 text-center lg:text-left">
      <div className="flex flex-col gap-2">
        <h1 className="type-display text-ink">KTP Patient Tracker</h1>
        <p className="type-body-lg text-ink-muted">For enrolled patients and the kidney transplant (KT) unit.</p>
      </div>
      {errorKind && !busy ? <ClayCardError message={ERRORS[errorKind]} className="text-left" /> : null}
      <div className="flex flex-col gap-2">
        <GoogleButton onClick={onGoogleSignIn} loading={busy} label={busy ? busyLabel : "Sign in with Google"} />
        <p role="status" className="sr-only">
          {busy ? busyLabel : ""}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-1 lg:justify-start">
          <p className="type-body-sm text-ink-muted">Use the Gmail address the KT unit has on file for you.</p>
          <button
            type="button"
            aria-expanded={whyOpen}
            aria-controls={whyId}
            onClick={() => setWhyOpen((open) => !open)}
            className="clay-focus type-button -mx-1 inline-flex h-11 cursor-pointer items-center gap-1 rounded-sm px-1 text-brick underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            Why Google?
            <ChevronDown aria-hidden strokeWidth={1.75} className={cn("size-4", whyOpen && "rotate-180")} />
          </button>
        </div>
        <p
          id={whyId}
          hidden={!whyOpen}
          className="type-body-sm rounded-md bg-sunken px-4 py-3 text-left text-ink"
        >
          KTP uses your Google account, so there is no extra password. The KT unit adds your Gmail address when you enroll.
        </p>
      </div>
      <div className="flex flex-col gap-1 border-t border-hairline pt-4 text-left">
        <p className="type-body-sm text-ink-muted">
          Only you and the KT unit can see your records. On your first sign-in, you will see a privacy notice (Data
          Privacy Act of 2012, RA 10173). You choose whether to agree.
        </p>
        <a
          href={privacyHref}
          onClick={onPrivacyClick}
          className="clay-focus type-button inline-flex h-11 items-center self-start rounded-sm text-brick underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          Privacy notice
        </a>
      </div>
    </div>
  );
}

function NotEnrolled({
  email,
  onUseAnotherAccount,
  onBackToSignIn,
}: {
  email?: string | null;
  onUseAnotherAccount: () => void;
  onBackToSignIn?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The body swapped under the user: move focus to the new heading so it is announced.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="flex flex-col gap-4 text-left">
      <h1 ref={headingRef} tabIndex={-1} className="type-headline text-ink outline-none">
        This Google account is not enrolled
      </h1>
      <p className="type-body-lg text-ink">
        We could not find{" "}
        {email ? <strong className="font-bold [overflow-wrap:anywhere]">{email}</strong> : "this Google account"} in KTP.
        If you are a KT unit patient, please ask them to check the Gmail address on file. Then sign in again.
      </p>
      <div className="flex flex-col gap-2">
        <MotionClayButton variant="primary" size="lg" icon={<LogIn strokeWidth={1.75} />} onClick={onUseAnotherAccount} className="w-full">
          Use another account
        </MotionClayButton>
        {onBackToSignIn ? (
          <MotionClayButton variant="secondary" size="lg" icon={<Undo2 strokeWidth={1.75} />} onClick={onBackToSignIn} className="w-full">
            Back to sign-in
          </MotionClayButton>
        ) : null}
      </div>
    </div>
  );
}
