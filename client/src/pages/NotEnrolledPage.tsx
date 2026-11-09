import { useEffect } from "react";
import { LockKeyhole } from "lucide-react";
import { ClayButton } from "@/components/clay/ClayButton";
import { ClayCard } from "@/components/clay/ClayCard";
import { startLogin } from "@/const";

export default function NotEnrolledPage() {
  useEffect(() => {
    document.title = "Workspace Access | KTP";
  }, []);

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-ground px-4 py-10 text-ink"
      aria-label="Workspace access"
    >
      <ClayCard surface={2} className="w-full max-w-md p-6 sm:p-8">
        <div className="clay-sunken mb-5 flex size-12 items-center justify-center rounded-lg text-ink-muted">
          <LockKeyhole aria-hidden className="size-6" />
        </div>
        <h1 className="type-title text-2xl">Use your local KTP account</h1>
        <p className="type-body mt-3 text-ink-muted">
          This workspace uses a local password. Return to sign-in to enter your
          password or complete first-time setup.
        </p>
        <ClayButton className="mt-6 w-full" onClick={startLogin}>
          Return to sign in
        </ClayButton>
      </ClayCard>
    </main>
  );
}
