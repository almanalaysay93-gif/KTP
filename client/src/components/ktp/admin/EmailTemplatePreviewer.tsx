import { useState } from "react";
import {
  Check,
  Eye,
  Laptop,
  Mail,
  RefreshCw,
  Send,
  Smartphone,
} from "lucide-react";
import { ClayButton, ClayCard } from "@/components/clay";
import { trpc } from "@/lib/trpc";

type TemplateKey =
  | "AppointmentNotice"
  | "OverdueLabAlert"
  | "WeeklyClinicalDigest"
  | "TestNotice";

interface EmailTemplatePreviewerProps {
  initialTemplate?: TemplateKey;
}

export function EmailTemplatePreviewer({
  initialTemplate = "AppointmentNotice",
}: EmailTemplatePreviewerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>(initialTemplate);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [testEmailAddress, setTestEmailAddress] = useState<string>("share@spmcdvo.net");
  const [dispatchStatus, setDispatchStatus] = useState<string>("");

  // Sample data controls
  const [patientName, setPatientName] = useState<string>("Juan Dela Cruz");
  const [hrn, setHrn] = useState<string>("KTP-2026-0001");
  const [appointmentDate, setAppointmentDate] = useState<string>("2026-10-06");
  const [doctorName, setDoctorName] = useState<string>("Dr. Maria Santos");
  const [labTitle, setLabTitle] = useState<string>("Complete Blood Count & Creatinine");
  const [dueDate, setDueDate] = useState<string>("2026-10-03");

  const previewQuery = trpc.automations.renderPreview.useQuery({
    templateName: selectedTemplate,
    sampleData: {
      patientName,
      hrn,
      appointmentDate,
      doctorName,
      labTitle,
      dueDate,
      time: "09:30 AM",
      activeCount: 38,
      pendingLabs: 6,
      upcomingVisits: 11,
      evalCount: 9,
    },
  });

  const sendTestMutation = trpc.automations.sendTestEmail.useMutation({
    onSuccess: data => {
      setDispatchStatus(`Test sent successfully (${data.status}).`);
      setTimeout(() => setDispatchStatus(""), 4000);
    },
    onError: err => {
      setDispatchStatus(`Failed: ${err.message}`);
    },
  });

  const handleSendTest = () => {
    if (!testEmailAddress || !testEmailAddress.includes("@")) return;
    sendTestMutation.mutate({
      to: testEmailAddress,
      templateName: selectedTemplate,
    });
  };

  const templates: { key: TemplateKey; label: string; desc: string }[] = [
    {
      key: "AppointmentNotice",
      label: "Appointment Reminder",
      desc: "Sent 48 hours prior to clinic visit with doctor and schedule details.",
    },
    {
      key: "OverdueLabAlert",
      label: "Overdue Lab Notice",
      desc: "Sent when required post-transplant monitoring tests pass due date.",
    },
    {
      key: "WeeklyClinicalDigest",
      label: "Weekly Nephrology Digest",
      desc: "Aggregated Monday summary of active cohort, visits, and pending labs.",
    },
    {
      key: "TestNotice",
      label: "System Verification",
      desc: "Diagnostic test dispatch to confirm Resend delivery pipeline health.",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Sidebar Template Selector & Controls */}
      <div className="lg:col-span-4 space-y-4">
        <ClayCard className="p-4 bg-[#fbfbf7] border border-[#c8ccb5] shadow-sm">
          <h3 className="text-xs font-semibold text-[#2c3320] tracking-wider uppercase mb-3">
            Clinical Email Templates
          </h3>
          <div className="space-y-2">
            {templates.map(tpl => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => setSelectedTemplate(tpl.key)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedTemplate === tpl.key
                    ? "bg-[#edf1e4] border-[#4f5b3a] shadow-sm"
                    : "bg-[#f3f5eb]/60 border-[#dce1ce] hover:bg-[#eef1e6]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#2c3320]">{tpl.label}</span>
                  {selectedTemplate === tpl.key && (
                    <span className="w-2 h-2 rounded-full bg-[#4f5b3a]" />
                  )}
                </div>
                <p className="text-[11px] text-[#606950] mt-1 line-clamp-2 leading-relaxed">
                  {tpl.desc}
                </p>
              </button>
            ))}
          </div>
        </ClayCard>

        {/* Live Merge Tags Customizer */}
        <ClayCard className="p-4 bg-[#fbfbf7] border border-[#c8ccb5] shadow-sm space-y-3">
          <h3 className="text-xs font-semibold text-[#2c3320] tracking-wider uppercase">
            Live Preview Parameters
          </h3>
          <div className="space-y-2.5 text-xs">
            <div>
              <label className="text-[11px] font-medium text-[#4b543b] block mb-1">
                Patient Name
              </label>
              <input
                type="text"
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
                className="clay-sunken clay-focus h-8 w-full rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs text-[#2c3320]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#4b543b] block mb-1">
                Hospital Record No. (HRN)
              </label>
              <input
                type="text"
                value={hrn}
                onChange={e => setHrn(e.target.value)}
                className="clay-sunken clay-focus h-8 w-full rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs text-[#2c3320] font-mono"
              />
            </div>
            {selectedTemplate === "AppointmentNotice" && (
              <>
                <div>
                  <label className="text-[11px] font-medium text-[#4b543b] block mb-1">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={e => setAppointmentDate(e.target.value)}
                    className="clay-sunken clay-focus h-8 w-full rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs text-[#2c3320]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#4b543b] block mb-1">
                    Attending Doctor
                  </label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={e => setDoctorName(e.target.value)}
                    className="clay-sunken clay-focus h-8 w-full rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs text-[#2c3320]"
                  />
                </div>
              </>
            )}
            {selectedTemplate === "OverdueLabAlert" && (
              <>
                <div>
                  <label className="text-[11px] font-medium text-[#4b543b] block mb-1">
                    Required Lab Panel
                  </label>
                  <input
                    type="text"
                    value={labTitle}
                    onChange={e => setLabTitle(e.target.value)}
                    className="clay-sunken clay-focus h-8 w-full rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs text-[#2c3320]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#4b543b] block mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="clay-sunken clay-focus h-8 w-full rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs text-[#2c3320]"
                  />
                </div>
              </>
            )}
          </div>
        </ClayCard>

        {/* Dispatch Test Box */}
        <ClayCard className="p-4 bg-[#e8ebde]/70 border border-[#c8ccb5] shadow-sm space-y-2">
          <h3 className="text-xs font-semibold text-[#2c3320] tracking-wider uppercase">
            Send Live Sample
          </h3>
          <p className="text-[11px] text-[#606950]">
            Dispatches rendered template directly to an inbox to verify formatting in live email
            clients.
          </p>
          <div className="flex gap-2 pt-1">
            <input
              type="email"
              value={testEmailAddress}
              onChange={e => setTestEmailAddress(e.target.value)}
              placeholder="name@hospital.org"
              className="clay-sunken clay-focus h-8 flex-1 rounded-md border border-[#c8ccb5] bg-[#fbfbf7] px-2.5 text-xs text-[#2c3320]"
            />
            <ClayButton
              variant="primary"
              size="sm"
              onClick={handleSendTest}
              disabled={sendTestMutation.isPending}
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              Send
            </ClayButton>
          </div>
          {dispatchStatus && (
            <p className="text-[11px] font-medium text-[#3e472f] mt-1">{dispatchStatus}</p>
          )}
        </ClayCard>
      </div>

      {/* Main Preview Container */}
      <div className="lg:col-span-8 space-y-3">
        {/* Viewport & Info Header */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#e8ebde]/70 border border-[#c8ccb5]">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#4f5b3a]" />
            <span className="text-xs font-semibold text-[#2c3320]">
              {previewQuery.data?.subject || "Rendering template subject..."}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#dce1ce] p-1 rounded-md border border-[#c8ccb5]">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              className={`p-1 rounded text-xs transition-colors ${
                viewport === "desktop"
                  ? "bg-[#4f5b3a] text-[#fbfbf7] shadow-sm"
                  : "text-[#4b543b] hover:bg-[#cfd5be]"
              }`}
              title="Desktop viewport (600px)"
            >
              <Laptop className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              className={`p-1 rounded text-xs transition-colors ${
                viewport === "mobile"
                  ? "bg-[#4f5b3a] text-[#fbfbf7] shadow-sm"
                  : "text-[#4b543b] hover:bg-[#cfd5be]"
              }`}
              title="Mobile viewport (360px)"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sandboxed Email Preview Area */}
        <div className="flex justify-center p-4 rounded-xl bg-[#d5dad0]/50 border border-[#c8ccb5] min-h-[580px] overflow-auto">
          {previewQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#606950]">
              <RefreshCw className="w-6 h-6 animate-spin text-[#4f5b3a] mb-2" />
              <p className="text-xs">Generating responsive HTML stationery...</p>
            </div>
          ) : previewQuery.data?.html ? (
            <div
              className="transition-all duration-300 shadow-md rounded-lg overflow-hidden bg-white border border-[#c8ccb5]"
              style={{
                width: viewport === "desktop" ? "600px" : "360px",
                maxWidth: "100%",
                minHeight: "560px",
              }}
            >
              <iframe
                title="Email stationery preview"
                srcDoc={previewQuery.data.html}
                className="w-full h-full min-h-[560px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="py-24 text-center text-xs text-[#606950]">
              No preview content rendered.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
