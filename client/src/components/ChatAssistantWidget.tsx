import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Bot,
  Calendar,
  CalendarCheck,
  Clock,
  Layers,
  RotateCcw,
  Send,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export interface TopicPill {
  id: string;
  name: string;
  short_desc?: string;
}

export type ChatEntry = {
  role: "user" | "assistant";
  content: string;
  topicId?: string | null;
  title?: string;
  matchType?: string;
  relatedTopics?: TopicPill[];
  candidateTopics?: TopicPill[];
  contactSnippet?: string;
  liveSynced?: boolean;
  isError?: boolean;
  retryQuery?: string;
  retryTopicId?: string;
  actionLinks?: Array<{ label: string; url: string }>;
};

const DEFAULT_TOPICS: Array<{ id: string; name: string; short_desc: string; icon: typeof AlertTriangle }> = [
  { id: "needs_attention", name: "Needs Attention", short_desc: "Expiring & overdue records", icon: AlertTriangle },
  { id: "find_staff", name: "Find Staff", short_desc: "Nurses & attendants", icon: Users },
  { id: "license_status", name: "License Status", short_desc: "Expiry & renewal", icon: Award },
  { id: "training_followup", name: "Training Follow-up", short_desc: "Pending & missing evidence", icon: Clock },
  { id: "upcoming_seminars", name: "Upcoming Seminars", short_desc: "Seminars & LDI", icon: CalendarCheck },
  { id: "area_assignments", name: "Area Assignments", short_desc: "Staff by clinical unit", icon: Layers },
  { id: "calendar", name: "Calendar", short_desc: "Events & scheduled training", icon: Calendar },
  { id: "reports", name: "Reports", short_desc: "Choose & export reports", icon: BarChart3 },
];

/** Floating NurseTrack Assistant mounted in supervisor DashboardLayout. */
export function ChatAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [historyStack, setHistoryStack] = useState<ChatEntry[][]>([]);
  const [question, setQuestion] = useState("");
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef<{ q?: string; tId?: string }>({});

  const inquiry = trpc.inquiry.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          topicId: data.topic_id,
          title: data.title,
          matchType: data.match_type,
          relatedTopics: data.related_topics,
          candidateTopics: data.candidate_topics,
          contactSnippet: data.contact_snippet,
          liveSynced: data.live_synced,
          isError: !data.success,
          retryQuery: lastSentRef.current.q,
          retryTopicId: lastSentRef.current.tId,
          actionLinks: data.action_links,
        },
      ]);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to contact inquiry service.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err.message || "Inquiry service connection failed. Please retry or open module directly.",
          isError: true,
          retryQuery: lastSentRef.current.q,
          retryTopicId: lastSentRef.current.tId,
          actionLinks: [{ label: "Open Dashboard", url: "/dashboard" }],
        },
      ]);
    },
  });

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, inquiry.isPending]);

  function sendQuestion(customQuery?: string, topicId?: string) {
    const q = (customQuery ?? question).trim();
    if (!q && !topicId) return;

    lastSentRef.current = { q, tId: topicId };

    // Record user bubble
    const userMsg: ChatEntry = {
      role: "user",
      content: topicId
        ? DEFAULT_TOPICS.find((t) => t.id === topicId)?.name || topicId
        : q,
      topicId: topicId || null,
    };

    setHistoryStack((prev) => [...prev, messages]);
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");

    // Send to tRPC inquiry router
    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    inquiry.mutate({
      question: q,
      topicId: topicId || null,
      history: historyPayload.slice(-10),
    });
  }

  function handleSelectTopic(topicId: string, topicName: string) {
    sendQuestion("", topicId);
  }

  function handleBack() {
    if (historyStack.length === 0) return;
    const prevMessages = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setMessages(prevMessages);
  }

  function handleReset() {
    setHistoryStack([]);
    setMessages([]);
    setQuestion("");
  }

  return (
    <>
      {/* Floating launcher button */}
      <div className="fixed bottom-5 right-5 z-40">
        <Button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg transition-transform duration-200 active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90"
          aria-label={open ? "Close NurseTrack Assistant" : "Open NurseTrack Assistant"}
        >
          {open ? <X className="h-5 w-5" /> : <Bot className="h-6 w-6" />}
        </Button>
      </div>

      {/* Floating Chat Modal Card */}
      {open && (
        <Card
          className={cn(
            "fixed z-50 flex flex-col shadow-2xl border bg-background/95 backdrop-blur-md transition-all duration-200",
            isMobile
              ? "inset-x-3 bottom-20 top-16 max-h-[85vh] rounded-xl"
              : "bottom-20 right-5 w-[420px] h-[580px] rounded-xl"
          )}
        >
          {/* Header */}
          <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-sm font-semibold leading-tight">
                  NurseTrack Assistant
                </CardTitle>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Supervisor Task Assistant</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    title="Back to previous question"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    title="Start over"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Start over"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-7 w-7"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Quick topic buttons bar */}
          <div className="bg-muted/40 border-b px-2.5 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
            {DEFAULT_TOPICS.map((topic) => {
              const Icon = topic.icon;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleSelectTopic(topic.id, topic.name)}
                  disabled={inquiry.isPending}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-accent shrink-0 shadow-xs active:scale-95 disabled:opacity-50"
                >
                  <Icon className="h-3 w-3 text-primary" />
                  {topic.name}
                </button>
              );
            })}
          </div>

          {/* Chat Messages */}
          <CardContent className="flex-1 flex flex-col gap-2.5 p-3 min-h-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto -mx-1 px-1">
              {messages.length === 0 ? (
                <div className="py-3 px-1 text-center space-y-3">
                  <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">NurseTrack Assistant</h4>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Operational summaries, staff lookups, license compliance, seminar schedules,
                      and export shortcuts for supervisors.
                    </p>
                  </div>

                  {/* 2-column, 8-button layout */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-left">
                    {DEFAULT_TOPICS.map((topic) => {
                      const Icon = topic.icon;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => handleSelectTopic(topic.id, topic.name)}
                          disabled={inquiry.isPending}
                          className="flex flex-col p-2.5 rounded-lg border bg-card hover:bg-accent/60 transition-colors text-left group shadow-xs"
                        >
                          <div className="flex items-center gap-1.5 font-medium text-xs text-foreground group-hover:text-primary">
                            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate">{topic.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {topic.short_desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-1">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div className="flex gap-2 max-w-[90%]">
                        {m.role === "assistant" && (
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                            <Bot className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                            m.role === "user"
                              ? "bg-primary text-primary-foreground font-medium ml-auto"
                              : "bg-muted text-foreground border"
                          )}
                        >
                          {m.content}
                        </div>
                        {m.role === "user" && (
                          <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5 text-secondary-foreground">
                            <User className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Action Links Buttons */}
                      {m.role === "assistant" && m.actionLinks && m.actionLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-8 pt-0.5">
                          {m.actionLinks.map((act, actIdx) => (
                            <button
                              key={actIdx}
                              type="button"
                              onClick={() => navigate(act.url)}
                              className="inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 border border-primary/30 px-2.5 py-1 text-xs font-medium text-primary transition-colors active:scale-95"
                            >
                              <span>{act.label}</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Interactive candidate topic buttons for multiple matches */}
                      {m.role === "assistant" && m.candidateTopics && m.candidateTopics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-8 pt-0.5">
                          {m.candidateTopics.map((cand) => (
                            <button
                              key={cand.id}
                              type="button"
                              onClick={() => handleSelectTopic(cand.id, cand.name)}
                              disabled={inquiry.isPending}
                              className="rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary transition-colors active:scale-95"
                            >
                              {cand.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Related topic suggestions for single matches */}
                      {m.role === "assistant" &&
                        (!m.candidateTopics || m.candidateTopics.length === 0) &&
                        m.relatedTopics &&
                        m.relatedTopics.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pl-8 pt-0.5">
                            <span className="text-[10px] text-muted-foreground mr-1">Related:</span>
                            {m.relatedTopics.map((rel) => (
                              <button
                                key={rel.id}
                                type="button"
                                onClick={() => handleSelectTopic(rel.id, rel.name)}
                                disabled={inquiry.isPending}
                                className="rounded-full border bg-background hover:bg-accent px-2 py-0.5 text-[10px] font-medium text-foreground transition-colors active:scale-95"
                              >
                                {rel.name}
                              </button>
                            ))}
                          </div>
                        )}

                      {/* Retryable failure banner and action */}
                      {m.role === "assistant" && m.isError && (
                        <div className="pl-8 pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => sendQuestion(m.retryQuery, m.retryTopicId)}
                            disabled={inquiry.isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 transition-colors active:scale-95"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Retry Question
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {inquiry.isPending && (
                    <div className="flex gap-2 items-center">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="rounded-lg px-3 py-2 text-xs bg-muted flex items-center gap-2 text-muted-foreground">
                        <Spinner className="h-3 w-3" /> Querying NurseTrack records…
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Typed Question Input Bar */}
            <div className="flex gap-1.5 shrink-0 pt-1 border-t">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendQuestion();
                  }
                }}
                placeholder="Ask about staff, licenses, trainings, seminars, areas…"
                className="min-h-[38px] max-h-24 resize-none text-xs"
                rows={1}
              />
              <Button
                type="button"
                size="icon"
                onClick={() => sendQuestion()}
                disabled={inquiry.isPending || !question.trim()}
                className="h-[38px] w-[38px] shrink-0"
                aria-label="Send question"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
