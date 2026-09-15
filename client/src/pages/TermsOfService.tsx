import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { useLocation } from "wouter";

export default function TermsOfService() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Application
        </Button>

        <Card className="glass-card shadow-lg border">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <FileText className="h-6 w-6" />
              <span className="text-sm font-semibold uppercase tracking-wider">Institutional Guidelines</span>
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
              Terms of Service & Clinical Governance
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Last Updated: September 15, 2026 &middot; Southern Philippines Medical Center (SPMC) Nephrology Cluster
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using SKTI NurseTrack, hospital employees, clinical coordinators, and nursing supervisors
                agree to adhere to these Terms of Service and hospital administrative guidelines. This system is intended
                strictly for official institutional use within the Southern Philippines Medical Center.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">2. Authorized Use & Account Responsibility</h2>
              <p className="text-muted-foreground">
                Users must authenticate via authorized hospital Google Workspace credentials or verified Professional
                Regulation Commission (PRC) license identifiers. Users are strictly responsible for maintaining the confidentiality
                of active sessions and must promptly report unauthorized access.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">3. Accuracy of Credential Submissions</h2>
              <p className="text-muted-foreground">
                All submitted licenses, training certificates, and seminar attendance records must reflect genuine, unaltered
                documentation. Submitting falsified accreditation records constitutes a violation of hospital administrative
                standards and PRC regulatory codes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">4. System Availability & Maintenance</h2>
              <p className="text-muted-foreground">
                SKTI NurseTrack undergoes scheduled updates and database synchronization to ensure high availability and data integrity.
                While the system strives for continuous service, administrative staff are encouraged to preserve offline physical
                copies of regulatory certificates.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">5. Modifications to Terms</h2>
              <p className="text-muted-foreground">
                Hospital administration reserves the right to amend these terms in accordance with Department of Health directives
                and hospital policy revisions. Updates take effect immediately upon publication to this page.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
