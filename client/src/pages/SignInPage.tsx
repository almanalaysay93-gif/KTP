import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { KtpSignIn, type KtpSignInStatus } from "@/components/ktp/KtpSignIn";
import { startLogin } from "@/const";

export default function SignInPage() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<KtpSignInStatus>("idle");

  useEffect(() => {
    document.title = "Sign In | KTP";
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
      onGoogleSignIn={handleGoogleSignIn}
      privacyHref="/privacy"
    />
  );
}
