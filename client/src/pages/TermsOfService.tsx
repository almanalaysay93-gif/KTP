import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText } from "lucide-react"
import { useLocation } from "wouter"

export default function TermsOfService() {
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
              <FileText className="h-6 w-6" />
              <span className="text-sm font-semibold uppercase tracking-wider">Institutional Guidelines</span>
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
              Terms of Service and Clinical Governance
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Southern Philippines Medical Center (SPMC) Organ Transplant Services
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using the Kidney Transplant Patient Tracker (KTP), patients, clinical coordinators, and nephrologists agree to adhere to these Terms of Service and hospital clinical guidelines. This system is intended strictly for official transplant care coordination within the Southern Philippines Medical Center.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">2. Authorized Use and Account Responsibility</h2>
              <p className="text-muted-foreground">
                Patients authenticate using their enrolled Google account after clinic registration. Users are responsible for maintaining the security of their accounts and devices. Users must promptly notify clinic staff if they suspect unauthorized access.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">3. Clinical Information Accuracy</h2>
              <p className="text-muted-foreground">
                Clinical records, laboratory entries, and appointment dates are maintained by authorized clinic personnel. Patients must keep their contact information updated to receive timely notifications regarding critical lab tests and medication supply claim deadlines.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">4. System Availability and Emergency Care</h2>
              <p className="text-muted-foreground">
                KTP provides tracking and coordination services. It is not an emergency response dispatch. In medical emergencies, patients must immediately contact the KT Unit 24/7 hotline or report to the nearest hospital emergency department.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">5. Modifications to Terms</h2>
              <p className="text-muted-foreground">
                Hospital administration reserves the right to amend these terms in accordance with Department of Health directives and clinical governance policies. Updates take effect upon publication to this page.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
