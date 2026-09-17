import { NurseAvatar } from "@/components/nursetrack/NurseAvatar";
import { EmploymentStatusBadge, LicenseStatusBadge, TrainingStatusBadge } from "@/components/nursetrack/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  BadgePercent,
  CalendarDays,
  Clock,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  MoveRight,
  RefreshCw,
  Send,
  Stethoscope,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDate, LICENSE_STATUS_SEVERITY, type LicenseStatus } from "../../../shared/nursetrack";

function formatEmailType(type: string): string {
  switch (type) {
    case "training_reminder":
      return "Training Reminder";
    case "training_notice":
      return "Training Notice";
    case "license_expiry":
    case "license_expiry_warning":
      return "PRC License Warning";
    case "manual_notice":
      return "Manual Notice";
    default:
      return type.replace(/_/g, " ");
  }
}

function formatThreshold(key: string | null): string {
  switch (key) {
    case "1y":
      return "1 Year Out";
    case "6m":
      return "6 Months Out";
    case "3m":
      return "3 Months Out";
    case "1m":
      return "1 Month Out";
    case "14d":
      return "14 Days Out";
    case "7d":
      return "7 Days Out";
    case "1d":
      return "1 Day Out";
    default:
      return key || "None";
  }
}

function formatLogTimestamp(val: any): string {
  if (!val) return "None";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val).slice(0, 16);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return String(val).slice(0, 16);
  }
}

export default function Dashboard() {
  const utils = trpc.useUtils();
  const { data: initial, isLoading: initialLoading } = trpc.dashboard.initial.useQuery();
  const { data: emailLogs, isLoading: emailLogsLoading, refetch: refetchEmailLogs } = trpc.settings.listEmailLogs.useQuery({ limit: 10 });
  const summary = initial?.summary;
  const actionCenter = initial?.actionCenter;
  const areas = initial?.areaSnapshots;
  const feed = initial?.activityFeed;
  const upcoming = initial?.upcoming;
  const summaryLoading = initialLoading;
  const actionLoading = initialLoading;
  const areasLoading = initialLoading;
  const feedLoading = initialLoading;
  const upcomingLoading = initialLoading;
  const [, navigate] = useLocation();
  const runReminders = trpc.settings.runRemindersNow.useMutation({
    onSuccess: (r) => {
      refetchEmailLogs();
      utils.dashboard.initial.invalidate();
      if (r.created > 0) {
        toast.success(`Created ${r.created} new reminders${r.expiredCredentials > 0 ? ` and flagged ${r.expiredCredentials} expired license(s)` : ""}.`);
      } else {
        toast.success("No new reminders needed. Everything is up to date.");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const statCards: {
    label: string;
    value: number | undefined;
    icon: React.ReactNode;
    tone: string;
    path: string;
  }[] = [
    {
      label: "Active Nurses",
      value: summary?.activeNurses,
      icon: <Users className="h-5 w-5" />,
      tone: "bg-[oklch(0.94_0.03_263)] text-[#122A5E] dark:bg-[oklch(0.25_0.05_250)] dark:text-[#7D96CC]",
      path: "/nurses",
    },
    {
      label: "Licenses — Within 1 Year",
      value: summary?.licensesWithin1Year,
      icon: <Clock className="h-5 w-5" />,
      tone: "bg-[oklch(0.95_0.03_215)] text-[#0891B2] dark:bg-[oklch(0.25_0.06_210)] dark:text-[#38BDF8]",
      path: "/licenses",
    },
    {
      label: "Licenses — Within 6 Months",
      value: summary?.licensesWithin6Months,
      icon: <AlertTriangle className="h-5 w-5" />,
      tone: "bg-[oklch(0.95_0.04_80)] text-[#CA8A04] dark:bg-[oklch(0.26_0.06_75)] dark:text-[#FBBF24]",
      path: "/licenses",
    },
    {
      label: "Licenses — Expired",
      value: summary?.licensesExpired,
      icon: <AlertCircle className="h-5 w-5" />,
      tone: "bg-[oklch(0.95_0.035_18)] text-[#F95A6B] dark:bg-[oklch(0.26_0.08_20)] dark:text-[#FB7185]",
      path: "/licenses",
    },
    {
      label: "Trainings — Need Attention",
      value: summary?.trainingsAttention,
      icon: <ListChecks className="h-5 w-5" />,
      tone: "bg-[oklch(0.94_0.04_145)] text-[#16A34A] dark:bg-[oklch(0.25_0.06_140)] dark:text-[#4ADE80]",
      path: "/trainings",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Training, licensing, and area assignment overview.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => runReminders.mutate(undefined as never)}
          disabled={runReminders.isPending}
        >
          {runReminders.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Clock className="h-4 w-4 mr-1" />
          )}
          {runReminders.isPending ? "Running Reminders…" : "Run Reminders Now"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {statCards.map((s, i) => (
          <button
            key={s.label}
            onClick={() => navigate(s.path)}
            className="group text-left last:col-span-2 md:last:col-span-1"
          >
            <Card className="glass-card text-left h-full">
              <CardContent className="pt-5 flex items-start justify-between gap-2">
                {summaryLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <span className="text-2xl font-bold tabular-nums">{s.value ?? 0}</span>
                )}
                <div className={cn("rounded-lg p-1.5 shrink-0", s.tone)}>{s.icon}</div>
              </CardContent>
              <CardContent className="pt-0 pb-4">
                <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 space-y-5">
          {/* Action center */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Action Center
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionSection title={`Urgent${(actionCenter?.urgent.length ?? 0) > 0 ? ` (${actionCenter!.urgent.length})` : ""}`} items={actionCenter?.urgent ?? []} navigate={navigate} loading={actionLoading} />
              <ActionSection title={`Next 30 days${(actionCenter?.next30Days.length ?? 0) > 0 ? ` (${actionCenter!.next30Days.length})` : ""}`} items={actionCenter?.next30Days ?? []} navigate={navigate} loading={actionLoading} />
              <ActionSection title={`Next 6 months${(actionCenter?.next6Months.length ?? 0) > 0 ? ` (${actionCenter!.next6Months.length})` : ""}`} items={actionCenter?.next6Months ?? []} navigate={navigate} loading={actionLoading} />
              <ActionSection title={`Next 1 year${(actionCenter?.next1Year.length ?? 0) > 0 ? ` (${actionCenter!.next1Year.length})` : ""}`} items={actionCenter?.next1Year ?? []} navigate={navigate} loading={actionLoading} />
            </CardContent>
          </Card>

          {/* Email Notification Log */}
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-sky-500" />
                  Email Notifications Log
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Recent automated license reminders and training assignment notifications dispatched to staff.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchEmailLogs()}
                  className="h-8 px-2.5 text-xs"
                  title="Refresh email logs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/settings")}
                  className="h-8 px-2.5 text-xs"
                >
                  Settings
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {emailLogsLoading ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !emailLogs || emailLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground space-y-2">
                  <Mail className="h-8 w-8 mx-auto opacity-40 text-sky-500" />
                  <p className="text-sm font-medium text-foreground">No email notifications dispatched yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Automated notices trigger when trainings are assigned or when PRC licenses reach 1 year, 6 months, 3 months, or 1 month before expiry.
                  </p>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={runReminders.isPending}
                      onClick={() => runReminders.mutate()}
                      className="text-xs"
                    >
                      {runReminders.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                      Run Reminders Now
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-muted-foreground font-medium">
                        <th className="px-3 py-2">Recipient / Nurse</th>
                        <th className="px-3 py-2">Notification Type</th>
                        <th className="px-3 py-2">Milestone</th>
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Dispatched</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {emailLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5">
                            {log.nurseId ? (
                              <button
                                onClick={() => navigate(`/nurses/${log.nurseId}`)}
                                className="text-left font-medium hover:underline text-foreground block truncate max-w-[170px]"
                              >
                                <span>{log.nurseName || log.recipientEmail}</span>
                                {log.nurseName && (
                                  <span className="block text-[10px] text-muted-foreground font-mono truncate">
                                    {log.recipientEmail}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <span className="font-mono text-muted-foreground truncate block max-w-[170px]" title={log.recipientEmail}>
                                {log.recipientEmail}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {formatEmailType(log.emailType)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {log.thresholdKey ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                {formatThreshold(log.thresholdKey)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">None</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 max-w-[200px] truncate" title={log.subject}>
                            {log.subject}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={
                                log.status === "sent"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : log.status === "mock_sent"
                                  ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                              }
                            >
                              {log.status === "sent" ? "Sent" : log.status === "mock_sent" ? "Mock Sent" : "Failed"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                            {formatLogTimestamp(log.sentAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming rail */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-500" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <>
                {upcoming?.upcomingCustoms.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 rounded-lg border p-2.5">
                    <div className="rounded-md bg-[oklch(0.95_0.03_215)] text-[#0891B2] p-1.5 shrink-0 dark:bg-[oklch(0.25_0.06_210)] dark:text-[#38BDF8]">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(e.date)}{e.nurseName ? ` · ${e.nurseName}` : ""}</p>
                    </div>
                  </div>
                ))}
                {upcoming?.upcomingLicenses.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/nurses/${l.nurseId}`)}
                    className="w-full flex items-start gap-3 rounded-lg border p-2.5 text-left hover:bg-accent transition-colors"
                  >
                    <div className="rounded-md bg-[#FFF3E3] text-[#B4700A] dark:bg-[oklch(0.26_0.06_75)] dark:text-[#FBBF24] p-1.5 shrink-0">
                      <BadgeCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{l.nurseName}</p>
                      <p className="text-xs text-muted-foreground">
                        License expires {formatDate(l.date)} · {l.daysRemaining} days
                      </p>
                    </div>
                  </button>
                ))}
                {(upcoming?.upcomingCustoms.length ?? 0) + (upcoming?.upcomingLicenses.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nothing upcoming yet.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Area snapshots */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Areas of Assignment</h2>
          <Link href="/areas" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <MoveRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {areasLoading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-40" />)
            : areas?.map((a) => (
                <Link key={a.id} href={`/areas/${a.id}`}>
                  <Card className="glass-card h-full">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-4 w-4 text-primary" />
                        <p className="font-medium text-sm truncate">{a.name}</p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {a.nurseCount} nurses
                        </span>
                        {a.licenseAttention > 0 && (
                          <span className="text-xs text-[#B4700A] dark:text-[#FBBF24] font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {a.licenseAttention} license attention
                          </span>
                        )}
                        {a.trainingAttention > 0 && (
                          <span className="text-xs text-[#16A34A] font-medium flex items-center gap-1 dark:text-[#4ADE80]">
                            <ListChecks className="h-3 w-3" /> {a.trainingAttention} training
                          </span>
                        )}
                      </div>
                      <div className="flex -space-x-2 mt-3">
                        {a.samplePhotos.length === 0 && (
                          <p className="text-xs text-muted-foreground">No nurses assigned</p>
                        )}
                        {a.samplePhotos.map((p: { id: number; profilePhotoKey: string }) => (
                          <img
                            key={p.id}
                            src={`/storage/${p.profilePhotoKey}`}
                            alt=""
                            className="h-7 w-7 rounded-full border-2 border-background object-cover"
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
        </div>
      </div>

      {/* Activity feed */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : feed?.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No activity yet. Add nurses, licenses, and trainings to get started.
            </p>
          ) : (
            <ul className="divide-y">
              {feed?.map((f) => (
                <li key={f.id} className="flex items-start gap-3 py-2.5">
                  <div className="rounded-md bg-secondary p-1.5 shrink-0">
                    <BadgePercent className="h-3.5 w-3.5 text-secondary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {f.summary}
                      {f.nurse && (
                        <button
                          onClick={() => navigate(`/nurses/${f.nurseId}`)}
                          className="text-primary hover:underline ml-1"
                        >
                          {f.nurse.firstName} {f.nurse.lastName}
                        </button>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionSection({
  title,
  items,
  navigate,
  loading,
}: {
  title: string;
  items: { kind: string; severity: string; title: string; date: string; nurseId: number; relatedEntityType?: string; relatedEntityId?: number }[];
  navigate: (p: string) => void;
  loading: boolean;
}) {
  if (loading) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">All clear.</p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 5).map((item, i) => (
            <button
              key={`${item.kind}-${item.relatedEntityId ?? i}`}
              onClick={() => navigate(`/nurses/${item.nurseId}`)}
              className={cn(
                "w-full text-left text-sm rounded-lg border px-3 py-2 flex items-center justify-between gap-2 hover:bg-accent transition-colors",
                item.severity === "urgent_or_expired" && "border-red-200 bg-red-50/50",
              )}
            >
              <span className="truncate">{item.title}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.date)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
