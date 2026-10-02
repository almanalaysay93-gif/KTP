import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  Users,
} from "lucide-react";
import {
  AdminShell,
  AdminToaster,
  useAdminToast,
} from "@/components/ktp/admin";
import { ClayButton, ClayCard, ClayInput } from "@/components/clay";
import {
  MotionRoot,
  OrganGridBackdrop,
  PageTransition,
} from "@/components/motion";
import { ADMIN_HREFS } from "@/lib/ktpAdminRoutes";
import { trpc } from "@/lib/trpc";
import { RECIPIENT_STAGES } from "@shared/ktp";

type TargetType = "All" | "Recipient" | "Donor" | "Stage" | "Specific";

export default function AdminMessagesPage() {
  const toast = useAdminToast();
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("All");
  const [targetStage, setTargetStage] = useState<string>("PostKT");
  const [targetPatientId, setTargetPatientId] = useState<number | undefined>(undefined);

  useEffect(() => {
    document.title = "Messages | KTP";
  }, []);

  const utils = trpc.useUtils();
  const messagesQuery = trpc.messages.list.useQuery();
  const patientsQuery = trpc.patients.list.useQuery(
    { status: "Active" },
    { enabled: targetType === "Specific" }
  );

  const createMutation = trpc.messages.create.useMutation({
    onSuccess: (data) => {
      utils.messages.list.invalidate();
      setSubject("");
      setBody("");
      setShowCompose(false);
      toast({
        title: "Broadcast dispatched",
        body: `Message delivered to ${data.recipientCount} patient(s).`,
        tone: "info",
      });
    },
    onError: (err) => {
      toast({
        title: "Broadcast failed",
        body: err.message || "Could not send broadcast message.",
        tone: "info",
      });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    createMutation.mutate({
      subject: subject.trim(),
      body: body.trim(),
      targetType,
      targetStage: targetType === "Stage" ? targetStage : undefined,
      targetPatientId: targetType === "Specific" ? targetPatientId : undefined,
    });
  };

  const messages = messagesQuery.data ?? [];

  return (
    <MotionRoot intensity="full">
      <AdminToaster>
        <div data-surface="admin" className="relative isolate min-h-dvh bg-ground text-ink">
          <OrganGridBackdrop />
          <AdminShell
            current="messages"
            hrefs={ADMIN_HREFS}
            hideUnavailable={false}
            mobileTitle="Messages"
            skipTo="messages-main"
            skipLabel="Skip to messages"
          >
            <PageTransition routeKey="admin-messages" focusHeading={false}>
              <div id="messages-main" className="flex flex-col gap-6 p-4 md:p-8">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <header className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-6 text-olive" />
                      <h1 className="type-display text-ink">Broadcast Messages</h1>
                    </div>
                    <p className="type-body-sm text-ink-muted">
                      Dispatch official clinic advisories, instructions, and announcements to patients
                    </p>
                  </header>

                  <ClayButton
                    onClick={() => setShowCompose((v) => !v)}
                    icon={showCompose ? undefined : <Plus className="size-4" />}
                  >
                    {showCompose ? "Close Compose" : "Compose Broadcast"}
                  </ClayButton>
                </div>

                {/* Compose Form */}
                {showCompose && (
                  <ClayCard className="p-5 sm:p-6 border-l-4 border-l-olive bg-surface-1">
                    <form onSubmit={handleSend} className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <Megaphone className="size-5 text-olive" />
                        <h2 className="type-headline text-ink">New Patient Announcement</h2>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block type-label text-ink">Target Audience</label>
                          <select
                            value={targetType}
                            onChange={(e) => setTargetType(e.target.value as TargetType)}
                            className="clay-focus w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 type-body text-ink"
                          >
                            <option value="All">All Active Patients</option>
                            <option value="Recipient">Recipients Only</option>
                            <option value="Donor">Donors Only</option>
                            <option value="Stage">By Patient Stage</option>
                            <option value="Specific">Specific Individual Patient</option>
                          </select>
                        </div>

                        {targetType === "Stage" && (
                          <div>
                            <label className="mb-1.5 block type-label text-ink">Select Stage</label>
                            <select
                              value={targetStage}
                              onChange={(e) => setTargetStage(e.target.value)}
                              className="clay-focus w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 type-body text-ink"
                            >
                              {RECIPIENT_STAGES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                              <option value="PostDonation">PostDonation</option>
                            </select>
                          </div>
                        )}

                        {targetType === "Specific" && (
                          <div>
                            <label className="mb-1.5 block type-label text-ink">Select Patient</label>
                            <select
                              value={targetPatientId ?? ""}
                              onChange={(e) => setTargetPatientId(Number(e.target.value) || undefined)}
                              className="clay-focus w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 type-body text-ink"
                              required
                            >
                              <option value="">-- Choose Patient --</option>
                              {(patientsQuery.data ?? []).map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.lastName}, {p.firstName} ({p.hrn})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <ClayInput
                        label="Broadcast Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Clinic Advisory: Holiday Schedule"
                        maxLength={200}
                        required
                      />

                      <div>
                        <label className="mb-1.5 block type-label text-ink">Message Body</label>
                        <textarea
                          rows={4}
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          placeholder="Type notice content clearly and accurately"
                          maxLength={4000}
                          required
                          className="clay-focus w-full rounded-2xl border border-hairline bg-surface-2 p-3 type-body text-ink"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <ClayButton
                          type="button"
                          variant="ghost"
                          onClick={() => setShowCompose(false)}
                        >
                          Cancel
                        </ClayButton>
                        <ClayButton
                          type="submit"
                          disabled={createMutation.isPending}
                          icon={<Send className="size-4" />}
                        >
                          {createMutation.isPending ? "Sending..." : "Dispatch Announcement"}
                        </ClayButton>
                      </div>
                    </form>
                  </ClayCard>
                )}

                {/* Sent Messages List */}
                <section className="flex flex-col gap-4">
                  <h2 className="type-headline text-ink">Sent Advisories & Delivery Tracking</h2>

                  {/* Loading */}
                  {messagesQuery.isLoading && (
                    <ClayCard className="p-8 text-center text-ink-muted">
                      <p className="type-body">Loading messages...</p>
                    </ClayCard>
                  )}

                  {/* Error */}
                  {messagesQuery.isError && (
                    <ClayCard className="p-8 text-center text-ink">
                      <p className="type-headline text-brick">Failed to load broadcast history</p>
                      <div className="mt-4 flex justify-center">
                        <ClayButton onClick={() => messagesQuery.refetch()}>Retry</ClayButton>
                      </div>
                    </ClayCard>
                  )}

                  {/* Empty */}
                  {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 && (
                    <ClayCard className="p-8 text-center text-ink-muted">
                      <p className="type-headline text-ink">No broadcast messages yet</p>
                      <p className="mt-2 type-body-sm">
                        Use the compose button above to send your first unit advisory or care instruction.
                      </p>
                    </ClayCard>
                  )}

                  {/* Cards */}
                  {!messagesQuery.isLoading && messages.length > 0 && (
                    <div className="flex flex-col gap-4">
                      {messages.map((msg) => {
                        const dateStr = new Date(msg.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        });

                        const ackPercent =
                          msg.recipientCount > 0
                            ? Math.round((msg.acknowledgedCount / msg.recipientCount) * 100)
                            : 0;

                        return (
                          <ClayCard key={msg.id} className="p-5">
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-md bg-surface-2 px-2.5 py-0.5 font-mono text-xs font-medium text-ink">
                                      {msg.targetType}
                                      {msg.targetStage ? `: ${msg.targetStage}` : ""}
                                    </span>
                                    <h3 className="type-headline text-ink">{msg.subject}</h3>
                                  </div>
                                  <p className="mt-1 type-caption text-ink-muted">Dispatched on {dateStr}</p>
                                </div>

                                {/* Delivery Statistics */}
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 type-body-sm font-medium text-ink">
                                    <Users className="size-4 text-ink-muted" />
                                    {msg.recipientCount} recipients
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 type-body-sm font-medium text-ink">
                                    <Eye className="size-4 text-ink-muted" />
                                    {msg.readCount} read
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-olive-tint px-3 py-1 type-body-sm font-medium text-olive">
                                    <CheckCircle2 className="size-4" />
                                    {msg.acknowledgedCount} acknowledged ({ackPercent}%)
                                  </span>
                                </div>
                              </div>

                              {/* Body preview */}
                              <div className="whitespace-pre-line rounded-xl bg-surface-2/40 p-4 type-body text-ink">
                                {msg.body}
                              </div>
                            </div>
                          </ClayCard>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </PageTransition>
          </AdminShell>
        </div>
      </AdminToaster>
    </MotionRoot>
  );
}
