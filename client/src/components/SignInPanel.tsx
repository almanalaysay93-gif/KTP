import { startLogin } from "@/const";
import { Link } from "wouter";
import { Button } from "./ui/button";

/** Signed-out supervisor sign-in card, shared by `/login` and protected routes. */
export function SignInPanel() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="auth-welcome-panel flex flex-col items-center gap-8 p-8 max-w-md w-full">
        <div className="flex flex-col items-center gap-6">
          <div className="h-24 px-3 rounded-2xl bg-white flex items-center justify-center shadow-sm">
            <img
              src="/branding/ots-logo.png"
              alt="Organ Transplant Services"
              className="h-20 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center">SKTI NurseTrack</h1>
          <p className="text-base text-muted-foreground text-center max-w-sm">
            Sign in as the supervisor to manage nurse training, licensing, and area assignments.
          </p>
        </div>
        <Button
          onClick={() => startLogin()}
          size="lg"
          className="w-full text-base py-6 shadow-lg hover:shadow-xl transition-all"
        >
          Sign in with Google
        </Button>
        <Link href="/staff-signin" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
          Nurse or attendant? Sign in here instead
        </Link>
      </div>
    </div>
  );
}
