import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Clock,
  HelpCircle,
  Mail,
  Receipt,
  RotateCcw,
  Send,
  Stethoscope,
  User,
  X,
  FileCheck2,
  GraduationCap,
  Layers,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
};

const DEFAULT_TOPICS: Array<{ id: string; name: string; short_desc: string; icon: typeof Stethoscope }> = [
  { id: "services", name: "Services", short_desc: "Dialysis & Transplant", icon: Stethoscope },
  { id: "hours", name: "Hours", short_desc: "Clinic & 24/7 Shifts", icon: Clock },
  { id: "location", name: "Location", short_desc: "SPMC Bajada Campus", icon: Building2 },
  { id: "requirements", name: "Requirements", short_desc: "Abstracts & Clearances", icon: FileCheck2 },
  { id: "fees", name: "Fees", short_desc: "PhilHealth 156 Sessions", icon: Receipt },
  { id: "trainings", name: "Seminars", short_desc: "Live Training Calendar", icon: GraduationCap },
  { id: "areas", name: "Units", short_desc: "Live Clinical Areas", icon: Layers },
  { id: "contact", name: "Contact", short_desc: "Trunkline & Locals", icon: Mail },
];

/** Floating General Inquiries rule-based assistant mounted once in DashboardLayout. */
export function ChatAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [historyStack, setHistoryStack] = useState<ChatEntry[][]>([]);
  const [question, setQuestion] = useState("");
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
        },
      ]);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to contact inquiry service.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err.message || "Inquiry service connection failed. Please retry or contact SPMC SKTI at (082) 227-2731.",
          isError: true,
          retryQuery: lastSentRef.current.q,
          retryTopicId: lastSentRef.current.tId,
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
    if ((!q && !topicId) || inquiry.isPending) return;

    lastSentRef.current = { q, tId: topicId };
    const displayLabel = q || topicId || "Inquiry";
    setHistoryStack((prev) => [...prev, messages]);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: displayLabel,
      },
    ]);

    inquiry.mutate({
      question: q,
      topicId: topicId || undefined,
    });

    if (!customQuery) {
      setQuestion("");
    }
  }

  function handleSelectTopic(tId: string, label?: string) {
    sendQuestion(label, tId);
  }

  function handleBack() {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setMessages(previous);
  }

  function handleStartOver() {
    setHistoryStack([]);
    setMessages([]);
    setQuestion("");
  }

  return (
    <>
      <Button
        type="button"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close General Inquiries" : "Open General Inquiries"}
        className={cn(
          "fixed right-5 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all",
          isMobile ? "bottom-20" : "bottom-6"
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <img
            src="/branding/spmc-nephro-cluster.jpg"
            alt="General Inquiries"
            className="h-11 w-11 object-contain rounded-full bg-white"
          />
        )}
      </Button>

      {open && (
        <Card
          className={cn(
            "fixed z-50 flex flex-col shadow-2xl border-2 bg-background",
            isMobile ? "bottom-36 right-3 left-3 h-[70vh]" : "bottom-24 right-5 w-96 h-[34rem]"
          )}
        >
          {/* Header */}
          <CardHeader className="py-2.5 px-3 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <img
                src="/branding/spmc-nephro-cluster.jpg"
                alt=""
                className="h-5 w-5 object-contain rounded-full bg-white border"
              />
              <span>General Inquiries</span>
            </CardTitle>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    disabled={historyStack.length === 0 || inquiry.isPending}
                    title="Back to previous topic"
                    className="h-7 px-2 text-xs flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Back</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleStartOver}
                    disabled={inquiry.isPending}
                    title="Start over"
                    className="h-7 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span className="hidden sm:inline">Start over</span>
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
                <div className="py-4 px-1 text-center space-y-3">
                  <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">SPMC SKTI Inquiries</h4>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Official information on dialysis shifts, kidney transplant evaluation, clinic hours, location,
                      and PhilHealth benefits.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 text-left">
                    {DEFAULT_TOPICS.map((topic) => {
                      const Icon = topic.icon;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => handleSelectTopic(topic.id, topic.name)}
                          disabled={inquiry.isPending}
                          className="flex flex-col p-2 rounded-lg border bg-card hover:bg-accent/60 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-1.5 font-medium text-xs text-foreground group-hover:text-primary">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            {topic.name}
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
                      <div className="flex gap-2 max-w-[88%]">
                        {m.role === "assistant" && (
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                            <HelpCircle className="h-3.5 w-3.5" />
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
                        <HelpCircle className="h-3.5 w-3.5" />
                      </div>
                      <div className="rounded-lg px-3 py-2 text-xs bg-muted flex items-center gap-2 text-muted-foreground">
                        <Spinner className="h-3 w-3" /> Checking approved records…
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
                placeholder="Ask about services, hours, fees, location…"
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
