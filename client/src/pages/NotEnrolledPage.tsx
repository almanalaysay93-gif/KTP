import { useEffect } from "react";
import { useLocation } from "wouter";
import { KtpSignIn } from "@/components/ktp/KtpSignIn";
import { startLogin } from "@/const";

export default function NotEnrolledPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = "Not Enrolled | KTP";
  }, []);

  return (
    <KtpSignIn
      status="not-enrolled"
      onGoogleSignIn={startLogin}
      onUseAnotherAccount={startLogin}
      onBackToSignIn={() => navigate("/login")}
      privacyHref="/privacy"
    />
  );
}
