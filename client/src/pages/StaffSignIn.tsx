import { useState } from "react";
import { useLocation } from "wouter";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * First-visit staff entry point. PRC/license number (registered nurses) or
 * employee ID (attendants with no PRC on file) claims one nurse profile for
 * 30 minutes so the staff member can save their Gmail. Return visits use
 * "Sign in with Google" below instead.
 * See docs/plans/2026-09-15-staff-signin-claim-then-google-design.md.
 */
export default function StaffSignInPage() {
  const [identifier, setIdentifier] = useState("");
  const [, navigate] = useLocation();

  const claimMutation = trpc.staffAccount.startClaim.useMutation({
    onSuccess: () => navigate("/me"),
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="auth-welcome-panel flex flex-col items-center gap-6 p-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-6">
          <img src="/branding/spmc-nephro-cluster.jpg" alt="" className="h-20 w-20 object-contain rounded-full bg-white" />
          <h1 className="text-2xl font-bold tracking-tight text-center">SKTI NurseTrack</h1>
        </div>

        <Card className="glass-card w-full p-6 space-y-4">
          <div>
            <h2 className="font-semibold">First visit</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your PRC / license number. If you're an attendant with no PRC on file, use your employee ID instead.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="identifier">PRC / License Number or Employee ID</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 0123456"
              onKeyDown={(e) => {
                if (e.key === "Enter" && identifier.trim() && !claimMutation.isPending) {
                  claimMutation.mutate({ identifier: identifier.trim() });
                }
              }}
            />
          </div>
          <Button
            className="w-full"
            disabled={!identifier.trim() || claimMutation.isPending}
            onClick={() => claimMutation.mutate({ identifier: identifier.trim() })}
          >
            {claimMutation.isPending ? "Checking..." : "Continue"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Not working? Contact your supervisor to confirm your record is on file.
          </p>
        </Card>

        <div className="w-full flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          Returning staff
          <div className="flex-1 h-px bg-border" />
        </div>

        <Button onClick={() => startLogin()} variant="outline" size="lg" className="w-full">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
