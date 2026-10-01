import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Shield } from "lucide-react"
import { useLocation } from "wouter"

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation()

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
              Privacy Policy and Data Protection
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Southern Philippines Medical Center (SPMC) Organ Transplant Services
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">1. Overview and Scope</h2>
              <p className="text-muted-foreground">
                The Kidney Transplant Patient Tracker (KTP) serves as the clinical monitoring registry for the Southern Philippines Medical Center Kidney Transplant Institute and Organ Transplant Services. This platform collects, records, and evaluates patient evaluation progress, laboratory tests, and appointment coordination in compliance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
              <p className="text-muted-foreground">
                The platform processes the following categories of patient health data:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Identification: Full name, hospital record number (HRN), date of birth, sex, and profile photograph.</li>
                <li>Clinical Status: Patient type (Recipient or Donor), clinical stage, surgery date, and care team assignments.</li>
                <li>Laboratory Records: Blood chemistry, hematology, therapeutic drug monitoring levels, urinalysis, and infectious disease markers.</li>
                <li>Evaluation Milestones: Pre-transplant workup items, imaging studies, medical clearances, and PhilHealth Z Package status.</li>
                <li>Contact Information: Account email and mobile phone number used for care coordination notices.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">3. Purpose of Processing</h2>
              <p className="text-muted-foreground">
                Data recorded within KTP is processed exclusively for transplant clinical operations, including:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Monitoring pre-transplant workup completion and post-transplant follow-up compliance.</li>
                <li>Tracking medication supply claim deadlines and laboratory test schedules.</li>
                <li>Coordinating clinic appointments and multi-specialty evaluations.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">4. Access Controls and Security Safeguards</h2>
              <p className="text-muted-foreground">
                Access to health records is strictly controlled. Patients can access only their own individual record after identity verification through Google OAuth and explicit privacy consent. Donors cannot access recipient records, and recipients cannot access donor records. Administrative access is restricted to authorized KT unit clinical staff through authenticated sessions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">5. Inquiries and Rights</h2>
              <p className="text-muted-foreground">
                Patients may review their recorded health information or request corrections through the patient portal or by contacting the SPMC Kidney Transplant Institute clinical coordinator directly.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
