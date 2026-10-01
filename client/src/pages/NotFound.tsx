import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, LayoutDashboard } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg shadow-xl border glass-card">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative p-3 rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-12 w-12" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">404</h1>
            <h2 className="text-xl font-semibold text-foreground/80">Page Not Found</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              The requested resource does not exist or may have been moved.
            </p>
          </div>

          <div className="pt-4 flex flex-wrap gap-2 justify-center">
            <Button
              onClick={() => setLocation("/")}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Return Home
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/dashboard")}
              className="gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
