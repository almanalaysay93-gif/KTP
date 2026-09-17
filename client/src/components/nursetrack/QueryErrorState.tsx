import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

/** Shown in place of a skeleton when a page query fails, so the page never hangs silently. */
export function QueryErrorState({
  title,
  error,
  onRetry,
  retrying = false,
}: {
  title: string;
  error: { message?: string } | null | undefined;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <Card className="glass-card" role="alert">
      <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground max-w-md">{error?.message || "Something went wrong. Try again."}</p>
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={`h-4 w-4 mr-1 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      </CardContent>
    </Card>
  );
}
