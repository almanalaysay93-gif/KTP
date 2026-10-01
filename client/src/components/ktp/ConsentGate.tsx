import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ClayButton, ClayCard } from "@/components/clay";
import { ShieldCheck, LogOut } from "lucide-react";

export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { user, refresh, logout } = useAuth();
  const [agreed, setAgreed] = useState(false);

  const consentQuery = trpc.auth.getConsentNotice.useQuery(undefined, {
    enabled: Boolean(user?.consentRequired),
  });

  const acceptMutation = trpc.auth.acceptConsent.useMutation({
    onSuccess: async () => {
      await refresh();
    },
  });

  if (!user || !user.consentRequired) {
    return <>{children}</>;
  }

  const noticeText =
    consentQuery.data?.consentNoticeText ??
    "By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination.";

  const handleAccept = async () => {
    if (!agreed) return;
    await acceptMutation.mutateAsync();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <ClayCard className="w-full max-w-lg p-6 sm:p-8">
        <div className="flex items-center gap-3 border-b border-hairline pb-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-olive-tint text-olive">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h2 className="type-headline text-ink">Privacy and Consent Notice</h2>
            <p className="type-body-sm text-ink-muted">Data Privacy Act of 2012 (RA 10173)</p>
          </div>
        </div>

        <div className="my-5 max-h-60 overflow-y-auto rounded-md bg-sunken p-4 type-body-sm text-ink leading-relaxed">
          {noticeText}
        </div>

        <label className="flex cursor-pointer items-start gap-3 select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 size-4 rounded border-hairline accent-olive"
          />
          <span className="type-body-sm text-ink">
            I have read and understood the privacy notice, and I agree to the collection and processing of my transplant health records.
          </span>
        </label>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <ClayButton
            variant="ghost"
            icon={<LogOut className="size-4" />}
            onClick={() => logout()}
          >
            Sign Out
          </ClayButton>
          <ClayButton
            variant="primary"
            disabled={!agreed || acceptMutation.isPending}
            onClick={handleAccept}
          >
            {acceptMutation.isPending ? "Accepting..." : "I Agree and Continue"}
          </ClayButton>
        </div>
      </ClayCard>
    </div>
  );
}
