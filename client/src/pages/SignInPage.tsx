import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { KtpSignIn, type KtpSignInErrorKind, type KtpSignInStatus } from "@/components/ktp/KtpSignIn";
import { startLogin } from "@/const";

export default function SignInPage() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<KtpSignInStatus>("idle");
  const [errorKind, setErrorKind] = useState<KtpSignInErrorKind | null>(null);

  useEffect(() => {
    document.title = "Sign In | KTP";
    if (typeof window === "undefined") return;
    const failed = new URLSearchParams(window.location.search).get("oauth") === "failed";
    if (failed) setErrorKind("generic");
  }, []);

  if (!loading && user) {
    return <Redirect to={user.isAdmin ? "/dashboard" : "/me"} />;
  }

  const handleGoogleSignIn = () => {
    setStatus("signing-in");
    startLogin();
  };

  return (
    <KtpSignIn
      status={status}
      errorKind={errorKind}
      onGoogleSignIn={handleGoogleSignIn}
      privacyHref="/privacy"
    />
  );
}
