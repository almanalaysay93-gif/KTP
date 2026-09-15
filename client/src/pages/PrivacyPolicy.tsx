import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
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
              <Shield className="h-6 w-6" />
              <span className="text-sm font-semibold uppercase tracking-wider">Clinical Governance</span>
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
              Privacy Policy & Data Protection
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Last Updated: September 15, 2026 &middot; Southern Philippines Medical Center (SPMC) Nephrology Cluster
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">1. Overview and Scope</h2>
              <p className="text-muted-foreground">
                SKTI NurseTrack serves as the institutional management registry for the Southern Philippines Medical Center
                Kidney Transplant Institute (SKTI) and Nephrology Nursing Cluster. This system collects, records, and evaluates
                personnel credentials, clinical assignments, and continuous learning records in compliance with the
                Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
              <p className="text-muted-foreground">
                The platform processes the following categories of personnel data:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Identification: Full name, employee ID, position, and profile photographs.</li>
                <li>Professional Credentials: Professional Regulation Commission (PRC) license numbers, issue dates, and renewal validity.</li>
                <li>Clinical Deployment: Area assignments across dialysis units, intensive care, and surgical wards.</li>
                <li>Training Compliance: Continuous Professional Development (CPD) units, seminar attendance, and training certificates.</li>
                <li>Contact Information: Institutional email addresses and phone numbers utilized strictly for regulatory renewal notices.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">3. Purpose of Processing</h2>
              <p className="text-muted-foreground">
                Data recorded within SKTI NurseTrack is processed exclusively for hospital operations, including:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Automated license expiry warnings to safeguard uninterrupted hospital clinical accreditation.</li>
                <li>Roster compliance checks across specialized renal replacement therapy units.</li>
                <li>Institutional reporting to the Department of Health (DOH) and Philippine Health Insurance Corporation (PhilHealth).</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">4. Access Controls & Security Safeguards</h2>
              <p className="text-muted-foreground">
                Access to staff records is governed by role-based authentication. Individual nursing staff can access only their
                own verified profile and credential ledger. Administrative modifications are restricted to authorized nursing supervisors
                and clinical coordinators through encrypted, authenticated session tokens.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">5. Data Inquiries & Corrections</h2>
              <p className="text-muted-foreground">
                Staff members wishing to verify or correct recorded training hours, certifications, or license entries may submit
                document verification requests via their personal portal or contact the SKTI Nursing Supervisory Office directly.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
