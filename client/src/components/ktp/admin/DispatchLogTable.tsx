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
import { ClayButton, ClayCard, ClayInput } from "@/components/clay";
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#4f5b3a]/15 text-[#333e22] border border-[#8b9474]/50">
            <CheckCircle2 className="w-3 h-3 text-[#4f5b3a]" />
            Sent
          </span>
        );
      case "mock_sent":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#3b5971]/15 text-[#203647] border border-[#7d9cb3]/50">
            <Mail className="w-3 h-3 text-[#3b5971]" />
            Mock Sent
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#ae3c30]/15 text-[#82241b] border border-[#ae3c30]/40">
            <AlertCircle className="w-3 h-3 text-[#ae3c30]" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#b47d1e]/15 text-[#6c480a] border border-[#d8aa58]/50">
            <Clock className="w-3 h-3 text-[#b47d1e]" />
            Queued
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#e8ebde]/70 border border-[#c8ccb5]">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-[#606950] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search recipient, HRN, subject..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-[#fbfbf7] border border-[#c8ccb5] focus:outline-none focus:ring-1 focus:ring-[#4f5b3a] text-[#2c3320]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#dce1ce] p-1 rounded-md border border-[#c8ccb5] text-xs">
            <Filter className="w-3.5 h-3.5 text-[#606950] ml-1 mr-0.5" />
            {(["all", "sent", "mock_sent", "failed"] as const).map(pill => (
              <button
                key={pill}
                type="button"
                onClick={() => setStatusFilter(pill)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === pill
                    ? "bg-[#4f5b3a] text-[#fbfbf7] shadow-sm"
                    : "text-[#4b543b] hover:bg-[#cfd5be]"
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
            className="p-1.5 rounded-md border border-[#c8ccb5] bg-[#fbfbf7] hover:bg-[#eef1e6] text-[#4b543b] transition-colors"
            title="Refresh logs"
          >
            <RefreshCw
              className={`w-4 h-4 ${logsQuery.isFetching ? "animate-spin text-[#4f5b3a]" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Main Ledger Table */}
      <ClayCard className="overflow-hidden border border-[#c8ccb5] bg-[#fbfbf7] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#e4e8d8] text-[#3e472f] border-b border-[#c8ccb5] font-semibold tracking-wider uppercase text-[11px]">
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Timestamp (UTC/Local)</th>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3">Template</th>
                <th className="py-2.5 px-3">Subject</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dce1ce]">
              {logsQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#606950]">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-1 text-[#4f5b3a]" />
                    Loading dispatch logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#606950]">
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
                      className={`hover:bg-[#f2f4ec] transition-colors cursor-pointer ${
                        isExpanded ? "bg-[#edf1e4]" : ""
                      }`}
                      onClick={() => setSelectedLogId(isExpanded ? null : item.id)}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-[#4b543b]">
                        {dateStr}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#2c3320] truncate max-w-[200px]">
                          {item.recipientEmail}
                        </div>
                        {item.patientHrn && (
                          <div className="text-[10px] text-[#606950] font-mono">
                            {item.patientHrn} {item.patientName ? `(${item.patientName})` : ""}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#e2e7d5] text-[#3e472f] border border-[#c8ccb5]">
                          {item.templateName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#3e472f] font-normal truncate max-w-[260px]">
                        {item.subject}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={e => e.stopPropagation()}
                        >
                          {onSelectTemplate && (
                            <button
                              type="button"
                              onClick={() => onSelectTemplate(item.templateName)}
                              className="p-1 rounded text-[#4b543b] hover:text-[#2c3320] hover:bg-[#dce1ce]"
                              title="Preview template"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.status === "failed" && (
                            <ClayButton
                              variant="secondary"
                              size="sm"
                              className="text-[11px] py-0.5 px-2 h-6"
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
                              <Send className="w-3 h-3 mr-1" />
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
          <div className="p-4 bg-[#e8ebde] border-t border-[#c8ccb5] text-xs space-y-2">
            {(() => {
              const item = filteredLogs.find(l => l.id === selectedLogId);
              if (!item) return null;
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[#2c3320]">
                      Dispatch Record #{item.id} Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedLogId(null)}
                      className="text-xs text-[#606950] hover:underline"
                    >
                      Close details
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#fbfbf7] p-3 rounded border border-[#c8ccb5]">
                    <div>
                      <p className="text-[11px] text-[#606950] uppercase font-semibold">Subject</p>
                      <p className="text-xs text-[#2c3320] font-medium mt-0.5">{item.subject}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#606950] uppercase font-semibold">Recipient</p>
                      <p className="text-xs text-[#2c3320] font-mono mt-0.5">{item.recipientEmail}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#606950] uppercase font-semibold">Template ID</p>
                      <p className="text-xs text-[#2c3320] font-mono mt-0.5">{item.templateName}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#606950] uppercase font-semibold">Status & Delivery</p>
                      <p className="text-xs text-[#2c3320] mt-0.5 font-medium">
                        {item.status.toUpperCase()}
                      </p>
                    </div>
                    {item.errorMessage && (
                      <div className="sm:col-span-2 p-2 rounded bg-[#ae3c30]/10 border border-[#ae3c30]/30 text-[#82241b]">
                        <p className="font-semibold text-[11px]">Dispatch Failure Error:</p>
                        <p className="font-mono text-[11px] mt-0.5">{item.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </ClayCard>
    </div>
  );
}
