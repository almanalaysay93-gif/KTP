import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Mail,
  RefreshCw,
  Search,
  Send,
  User,
} from "lucide-react";
import { ClayButton, ClayInput } from "@/components/clay";
import { trpc } from "@/lib/trpc";

interface DispatchLogTableProps {
  onSelectTemplate?: (templateName: string) => void;
}

export function DispatchLogTable({ onSelectTemplate }: DispatchLogTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  const logsQuery = trpc.automations.listLogs.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: searchTerm.trim() || undefined,
    limit: 50,
  });

  const utils = trpc.useUtils();

  const retryMutation = trpc.automations.sendTestEmail.useMutation({
    onSuccess: () => {
      utils.automations.listLogs.invalidate();
    },
  });

  const logs = logsQuery.data?.items || [];

  const filteredLogs = logs.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const recipient = (item.recipientEmail || "").toLowerCase();
    const subject = (item.subject || "").toLowerCase();
    const hrn = (item.patientHrn || "").toLowerCase();
    const name = (item.patientName || "").toLowerCase();
    return (
      recipient.includes(term) ||
      subject.includes(term) ||
      hrn.includes(term) ||
      name.includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 type-label bg-done-bg text-done border border-done/40">
            <CheckCircle2 className="size-3.5 text-done" />
            Sent
          </span>
        );
      case "mock_sent":
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 type-label bg-info-bg text-info border border-info/40">
            <Mail className="size-3.5 text-info" />
            Mock Sent
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 type-label bg-overdue-bg text-overdue border border-overdue/40">
            <AlertCircle className="size-3.5 text-overdue" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 type-label bg-due-soon-bg text-due-soon border border-due-soon/40">
            <Clock className="size-3.5 text-due-soon" />
            Queued
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-surface-1 border border-hairline">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search recipient, HRN, subject..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 type-body-sm rounded-md bg-surface-2 border border-hairline focus:outline-none focus:ring-1 focus:ring-brick text-ink"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-ground p-1 rounded-md border border-hairline">
            <Filter className="w-3.5 h-3.5 text-ink-muted ml-1 mr-0.5" />
            {(["all", "sent", "mock_sent", "failed"] as const).map(pill => (
              <button
                key={pill}
                type="button"
                onClick={() => setStatusFilter(pill)}
                className={`px-2.5 py-1 rounded type-body-sm transition-colors ${
                  statusFilter === pill
                    ? "bg-brick text-on-brick shadow-sm"
                    : "text-ink-muted hover:bg-sunken"
                }`}
              >
                {pill === "all"
                  ? "All"
                  : pill === "sent"
                  ? "Delivered"
                  : pill === "mock_sent"
                  ? "Simulated"
                  : "Failed"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => logsQuery.refetch()}
            disabled={logsQuery.isFetching}
            className="p-1.5 rounded-md border border-hairline bg-surface-2 hover:bg-row-hover text-ink-muted transition-colors"
            title="Refresh logs"
          >
            <RefreshCw
              className={`w-4 h-4 ${logsQuery.isFetching ? "animate-spin text-brick-text" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Main Ledger Table: an opaque clay card. Long emails, templates and subjects wrap inside their column. */}
      <div className="clay-table-wrap">
        <div className="show-scrollbar-x overflow-x-auto">
          <table className="clay-table min-w-[820px] table-fixed">
            <colgroup>
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-[22%]" />
              <col className="w-40" />
              <col />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Timestamp (UTC/Local)</th>
                <th scope="col">Recipient</th>
                <th scope="col">Template</th>
                <th scope="col">Subject</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-1 text-brick-text" />
                    Loading dispatch logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    No email dispatch records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(item => {
                  const isExpanded = selectedLogId === item.id;
                  const dateStr = new Date(item.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={item.id}
                      className={`cursor-pointer transition-colors ${isExpanded ? "is-hover" : ""}`}
                      onClick={() => setSelectedLogId(isExpanded ? null : item.id)}
                    >
                      <td className="whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="whitespace-nowrap font-mono text-ink-muted">
                        {dateStr}
                      </td>
                      <td>
                        <div className="font-medium text-ink break-all">
                          {item.recipientEmail}
                        </div>
                        {item.patientHrn && (
                          <div className="type-data text-ink-muted">
                            {item.patientHrn} {item.patientName ? `(${item.patientName})` : ""}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="inline-block max-w-full break-all align-bottom font-mono px-1.5 py-0.5 rounded bg-sage-tint text-ink-muted border border-hairline">
                          {item.templateName}
                        </span>
                      </td>
                      <td className="text-ink-muted font-normal">{item.subject}</td>
                      <td className="text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={e => e.stopPropagation()}
                        >
                          {onSelectTemplate && (
                            <button
                              type="button"
                              onClick={() => onSelectTemplate(item.templateName)}
                              className="p-1 rounded text-ink-muted hover:text-ink hover:bg-sunken"
                              title="Preview template"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.status === "failed" && (
                            <ClayButton
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const validTemplates = [
                                  "AppointmentNotice",
                                  "OverdueLabAlert",
                                  "WeeklyClinicalDigest",
                                  "TestNotice",
                                ] as const;
                                const validTpl = validTemplates.find(
                                  t => t === item.templateName
                                ) || "TestNotice";
                                retryMutation.mutate({
                                  to: item.recipientEmail,
                                  templateName: validTpl,
                                });
                              }}
                              disabled={retryMutation.isPending}
                            >
                              <Send className="mr-1 size-3.5" />
                              Retry
                            </ClayButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Log Drawer */}
        {selectedLogId && (
          <div className="mt-2 space-y-2 rounded-xl border border-hairline bg-surface-2 p-4 type-body-sm">
            {(() => {
              const item = filteredLogs.find(l => l.id === selectedLogId);
              if (!item) return null;
              return (
                <div>
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <span className="font-semibold text-ink">
                      Dispatch Record #{item.id} Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedLogId(null)}
                      className="type-body-sm text-ink-muted hover:underline"
                    >
                      Close details
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-1 p-3 rounded-lg border border-hairline">
                    <div>
                      <p className="type-body-sm font-semibold uppercase text-ink-muted">Subject</p>
                      <p className="type-body-sm text-ink font-medium mt-0.5 break-words">{item.subject}</p>
                    </div>
                    <div>
                      <p className="type-body-sm font-semibold uppercase text-ink-muted">Recipient</p>
                      <p className="type-body-sm text-ink font-mono mt-0.5 break-all">{item.recipientEmail}</p>
                    </div>
                    <div>
                      <p className="type-body-sm font-semibold uppercase text-ink-muted">Template ID</p>
                      <p className="type-body-sm text-ink font-mono mt-0.5 break-all">{item.templateName}</p>
                    </div>
                    <div>
                      <p className="type-body-sm font-semibold uppercase text-ink-muted">Status & Delivery</p>
                      <p className="type-body-sm text-ink mt-0.5 font-medium">
                        {item.status.toUpperCase()}
                      </p>
                    </div>
                    {item.errorMessage && (
                      <div className="sm:col-span-2 p-2 rounded bg-overdue-bg border border-overdue/30 text-overdue">
                        <p className="type-body-sm font-semibold">Dispatch Failure Error:</p>
                        <p className="type-body-sm font-mono mt-0.5 break-words">{item.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
