import { useState, useEffect } from "react";
import {
  Bell,
  Calendar,
  Check,
  Clock,
  FlaskConical,
  Loader2,
  Mail,
  Play,
  Save,
  Send,
} from "lucide-react";
import { ClayButton, ClayCard, ClayInput } from "@/components/clay";
import { StatusPulse } from "@/components/motion/StatusPulse";
import { trpc } from "@/lib/trpc";
import type { AutomationTriggerConfig } from "../../../../../server/emailService";

export function EmailAutomationPanel() {
  const utils = trpc.useUtils();
  const configQuery = trpc.automations.getConfig.useQuery();

  const [masterEnabled, setMasterEnabled] = useState<boolean>(true);
  const [dispatchTime, setDispatchTime] = useState<string>("08:00");
  const [triggers, setTriggers] = useState<AutomationTriggerConfig[]>([]);
  const [testEmail, setTestEmail] = useState<string>("share@spmcdvo.net");
  const [sweepResult, setSweepResult] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (configQuery.data) {
      setMasterEnabled(configQuery.data.masterEnabled);
      setDispatchTime(configQuery.data.dispatchTimeManila || "08:00");
      setTriggers(configQuery.data.triggers || []);
    }
  }, [configQuery.data]);

  const updateMutation = trpc.automations.updateConfig.useMutation({
    onSuccess: () => {
      utils.automations.getConfig.invalidate();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    onError: err => setError(err.message || "Failed to update configuration"),
  });

  const sweepMutation = trpc.automations.runManualSweep.useMutation({
    onSuccess: data => {
      utils.automations.listLogs.invalidate();
      utils.automations.getConfig.invalidate();
      const stats = data.stats;
      setSweepResult(
        `Sweep completed: ${stats.sent} sent, ${stats.failed} failed, ${stats.skipped} skipped.`
      );
      setTimeout(() => setSweepResult(""), 4000);
    },
    onError: err => setError(err.message || "Manual sweep failed"),
  });

  const testEmailMutation = trpc.automations.sendTestEmail.useMutation({
    onSuccess: data => {
      utils.automations.listLogs.invalidate();
      setSweepResult(`Test notification sent successfully (mode: ${data.status}).`);
      setTimeout(() => setSweepResult(""), 4000);
    },
    onError: err => setError(err.message || "Test dispatch failed"),
  });

  const handleToggleTrigger = (key: string) => {
    setTriggers(prev =>
      prev.map(t => (t.key === key ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const handleLeadDaysChange = (key: string, days: number) => {
    setTriggers(prev =>
      prev.map(t => (t.key === key ? { ...t, leadDays: Math.max(1, days) } : t))
    );
  };

  const handleSave = async () => {
    setError("");
    await updateMutation.mutateAsync({
      masterEnabled,
      dispatchTimeManila: dispatchTime,
      triggers,
    });
  };

  const handleRunSweep = async () => {
    setError("");
    await sweepMutation.mutateAsync();
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes("@")) {
      setError("Please provide a valid email address");
      return;
    }
    setError("");
    await testEmailMutation.mutateAsync({
      to: testEmail.trim(),
      templateName: "TestNotice",
    });
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-ink-muted">
        <Loader2 className="size-5 animate-spin mr-2" />
        <span>Loading automation settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Master Switch */}
      <ClayCard className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <StatusPulse active={masterEnabled} tone={masterEnabled ? "olive" : "neutral"}>
              <div className="flex size-10 items-center justify-center rounded-xl bg-olive-tint text-olive">
                <Bell className="size-5" />
              </div>
            </StatusPulse>
            <div>
              <h3 className="type-headline">Email Notification Automations</h3>
              <p className="type-body-sm text-ink-muted">
                Scheduled delivery of clinic visit reminders, overdue lab alerts, and digests.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="clay-focus inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={masterEnabled}
                onChange={e => setMasterEnabled(e.target.checked)}
                className="size-4 rounded border-line-strong text-olive focus:ring-olive"
              />
              <span>Master Dispatch {masterEnabled ? "Active" : "Paused"}</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-brick/30 bg-brick/10 p-3 text-xs text-brick">
            {error}
          </div>
        )}

        {sweepResult && (
          <div className="mt-4 flex items-center gap-2 rounded border border-olive/30 bg-olive-tint p-3 text-xs font-semibold text-olive">
            <Check className="size-4" /> {sweepResult}
          </div>
        )}
      </ClayCard>

      {/* Trigger Configuration Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {triggers.map(trigger => {
          const isAppt = trigger.key === "appointment_reminder";
          const isLab = trigger.key === "overdue_lab";

          return (
            <ClayCard
              key={trigger.key}
              className={`p-4 transition ${
                trigger.enabled ? "bg-surface-1" : "bg-ground opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isAppt ? (
                    <Calendar className="size-4 text-olive" />
                  ) : isLab ? (
                    <FlaskConical className="size-4 text-brick" />
                  ) : (
                    <Mail className="size-4 text-ink-muted" />
                  )}
                  <h4 className="font-bold text-xs text-ink">{trigger.label}</h4>
                </div>
                <input
                  type="checkbox"
                  checked={trigger.enabled}
                  onChange={() => handleToggleTrigger(trigger.key)}
                  className="size-4 rounded border-line-strong text-olive"
                  title="Enable or disable trigger"
                />
              </div>

              <p className="mt-2 text-[11px] text-ink-muted leading-relaxed">
                {trigger.description}
              </p>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[11px]">
                <span className="text-ink-muted">Lead time:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={trigger.leadDays}
                    onChange={e =>
                      handleLeadDaysChange(trigger.key, Number(e.target.value))
                    }
                    disabled={!trigger.enabled}
                    className="h-6 w-12 rounded border border-line-strong/30 bg-surface-1 px-1.5 text-right font-mono text-xs text-ink"
                  />
                  <span className="text-ink-muted">days</span>
                </div>
              </div>
            </ClayCard>
          );
        })}
      </div>

      {/* Manual Actions and Test Notice Tray */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ClayCard className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-olive" />
            <h4 className="font-bold text-xs text-ink">Schedule and Manual Trigger</h4>
          </div>
          <p className="text-xs text-ink-muted">
            Daily automated sweeps run at scheduled Manila time. Run immediately to dispatch pending notifications.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">Daily sweep time:</span>
              <input
                type="time"
                value={dispatchTime}
                onChange={e => setDispatchTime(e.target.value)}
                className="h-7 rounded border border-line-strong/30 bg-surface-1 px-2 text-xs text-ink"
              />
            </div>
            <ClayButton
              type="button"
              onClick={handleRunSweep}
              disabled={sweepMutation.isPending || !masterEnabled}
              className="inline-flex items-center gap-1.5 text-xs font-semibold"
            >
              {sweepMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Running...
                </>
              ) : (
                <>
                  <Play className="size-3.5" /> Run Sweep Now
                </>
              )}
            </ClayButton>
          </div>
        </ClayCard>

        <ClayCard className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Send className="size-4 text-olive" />
            <h4 className="font-bold text-xs text-ink">Send Test Notice</h4>
          </div>
          <p className="text-xs text-ink-muted">
            Verify email transport and formatting by sending a test message to an administrator address.
          </p>
          <form onSubmit={handleSendTest} className="flex items-center gap-2 pt-1">
            <ClayInput
              label="Recipient Address"
              name="testEmail"
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="admin@spmcdvo.net"
              className="h-8 text-xs flex-1"
              required
            />
            <ClayButton
              type="submit"
              variant="secondary"
              disabled={testEmailMutation.isPending}
              className="inline-flex items-center gap-1 text-xs"
            >
              {testEmailMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Mail className="size-3" />
              )}
              Send Test
            </ClayButton>
          </form>
        </ClayCard>
      </div>

      {/* Save Settings Bar */}
      <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
        {saveSuccess && (
          <span className="flex items-center gap-1 text-xs font-semibold text-olive">
            <Check className="size-3.5" /> Settings saved successfully
          </span>
        )}
        <ClayButton
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="inline-flex items-center gap-1.5 font-semibold"
        >
          {updateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save Automation Settings
        </ClayButton>
      </div>
    </div>
  );
}
