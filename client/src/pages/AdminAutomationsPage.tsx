import { useEffect, useState } from "react";
import { Eye, ListFilter, Mail, Sparkles } from "lucide-react";
import { ClayCard, ClayTabs, ClayTabsContent, ClayTabsList, ClayTabsTrigger } from "@/components/clay";
import { AdminShell, AdminToaster } from "@/components/ktp/admin";
import { DispatchLogTable } from "@/components/ktp/admin/DispatchLogTable";
import { EmailAutomationPanel } from "@/components/ktp/admin/EmailAutomationPanel";
import { EmailTemplatePreviewer } from "@/components/ktp/admin/EmailTemplatePreviewer";
import { MotionRoot, OrganGridBackdrop, PageTransition } from "@/components/motion";
import { ADMIN_HREFS } from "@/lib/ktpAdminRoutes";

type TabId = "automations" | "dispatch-logs" | "previewer";
type TemplateKey =
  | "AppointmentNotice"
  | "OverdueLabAlert"
  | "WeeklyClinicalDigest"
  | "TestNotice";

export default function AdminAutomationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("automations");
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] =
    useState<TemplateKey>("AppointmentNotice");

  useEffect(() => {
    document.title = "Automations & Notifications | KTP";
  }, []);

  const handleSelectTemplate = (templateName: string) => {
    const validTemplates: TemplateKey[] = [
      "AppointmentNotice",
      "OverdueLabAlert",
      "WeeklyClinicalDigest",
      "TestNotice",
    ];
    const match = validTemplates.find(t => t === templateName);
    if (match) {
      setSelectedTemplateForPreview(match);
      setActiveTab("previewer");
    }
  };

  return (
    <AdminToaster>
      <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
        <OrganGridBackdrop />
        <AdminShell
          current="automations"
          hrefs={ADMIN_HREFS}
          mobileTitle="Automations"
          skipTo="automations-main"
          skipLabel="Skip to email automations content"
        >
          <PageTransition routeKey="admin-automations" focusHeading={false}>
            <main id="automations-main" className="relative z-10 mx-auto w-full max-w-[1800px] space-y-6 px-4 pb-16 pt-3 md:px-6 lg:pb-20 lg:pt-8">
              {/* Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-brick/15 text-brick-text border border-brick/40">
                  <Mail className="w-5 h-5 text-brick-text" />
                </span>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
                  Clinical Email Automations
                </h1>
              </div>
              <p className="text-xs md:text-sm text-ink-muted mt-1">
                Scheduled notifications, clinic visit reminders, overdue lab alerts, and Resend delivery logs.
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <ClayTabs value={activeTab} onValueChange={val => setActiveTab(val as TabId)} className="w-full">
            <ClayTabsList className="bg-ground p-1 border border-hairline rounded-lg">
              <ClayTabsTrigger
                value="automations"
                className="flex items-center gap-2 text-xs md:text-sm font-medium px-4 py-2"
              >
                <Sparkles className="w-4 h-4 text-brick-text" />
                Automations & Schedule
              </ClayTabsTrigger>
              <ClayTabsTrigger
                value="dispatch-logs"
                className="flex items-center gap-2 text-xs md:text-sm font-medium px-4 py-2"
              >
                <ListFilter className="w-4 h-4 text-brick-text" />
                Dispatch Audit Ledger
              </ClayTabsTrigger>
              <ClayTabsTrigger
                value="previewer"
                className="flex items-center gap-2 text-xs md:text-sm font-medium px-4 py-2"
              >
                <Eye className="w-4 h-4 text-brick-text" />
                Template Previewer
              </ClayTabsTrigger>
            </ClayTabsList>

            <div className="mt-6">
              <ClayTabsContent value="automations">
                <EmailAutomationPanel />
              </ClayTabsContent>

              <ClayTabsContent value="dispatch-logs">
                <DispatchLogTable onSelectTemplate={handleSelectTemplate} />
              </ClayTabsContent>

              <ClayTabsContent value="previewer">
                <EmailTemplatePreviewer initialTemplate={selectedTemplateForPreview} />
              </ClayTabsContent>
            </div>
          </ClayTabs>
        </main>
      </PageTransition>
    </AdminShell>
  </div>
</AdminToaster>
  );
}
