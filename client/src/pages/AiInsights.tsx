import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, Copy, FileText, Send, Sparkles, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ChatEntry = { role: "user" | "assistant"; content: string };
type ReportSection = { code: string; title: string; lines: string[] };
type Report = { generatedFor: string; sections: ReportSection[]; text: string };

export default function AiInsightsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [question, setQuestion] = useState("");

  const generateReport = trpc.aiInsights.generateReport.useMutation({
    onMutate: () => {
      setReportError(null);
    },
    onSuccess: (data) => {
      setReport({ generatedFor: data.generatedFor, sections: data.sections, text: data.text });
      setReportGeneratedAt(data.generatedAt);
      setReportError(null);
      toast.success("Insights report generated.");
    },
    onError: (err) => {
      setReportError(err.message);
      toast.error(err.message);
    },
  });

  const chat = trpc.aiInsights.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    },
    onError: (err) => toast.error(err.message),
  });

  function sendQuestion() {
    const q = question.trim();
    if (!q || chat.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    chat.mutate({ question: q, history: messages });
    setQuestion("");
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Insights
          </CardTitle>
          <CardDescription>
            Rule-based reports from your current roster, license, and training data. No AI model is used, and nothing here changes any records.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Report
          </CardTitle>
          <CardDescription>Urgent/upcoming license expirations, upcoming trainings and seminars, and staffing patterns.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            onClick={() => generateReport.mutate()}
            disabled={generateReport.isPending}
          >
            {generateReport.isPending ? <Spinner className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {generateReport.isPending ? "Generating…" : report ? "Regenerate Report" : "Generate Report"}
          </Button>

          {generateReport.isPending && (
            <div className="rounded-lg border bg-muted/40 p-4 flex items-center gap-3">
              <Spinner className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Building the report…</p>
                <p className="text-xs text-muted-foreground">Checking license expirations, training schedules, and area coverage.</p>
              </div>
            </div>
          )}

          {reportError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-start justify-between gap-3 text-sm text-destructive">
              <div>
                <p className="font-semibold">Unable to generate the report</p>
                <p className="text-xs mt-1 text-destructive/90">{reportError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateReport.mutate()}
                disabled={generateReport.isPending}
                className="shrink-0 text-xs h-8 border-destructive/30 hover:bg-destructive/10 text-destructive"
              >
                Retry
              </Button>
            </div>
          )}

          {report && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Report for {report.generatedFor}
                  {reportGeneratedAt && ` · generated ${new Date(reportGeneratedAt).toLocaleString()}`}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(report.text)
                      .then(() => toast.success("Report copied."))
                      .catch(() => toast.error("Could not copy the report."))
                  }
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              {report.sections.map((section) => (
                <section key={section.code} aria-labelledby={`insights-${section.code}`}>
                  <h3 id={`insights-${section.code}`} className="text-sm font-semibold mb-1">
                    {section.title}
                  </h3>
                  <ul className="list-disc pl-5 space-y-0.5 text-sm leading-relaxed">
                    {section.lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> Ask a Question
          </CardTitle>
          <CardDescription>e.g. "Who in RDU Main has an expired license?" or "How many nurses are in SKTI ICU?"</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.length > 0 && (
            <ScrollArea className="h-80 rounded-lg border p-3">
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && <Bot className="h-5 w-5 shrink-0 text-muted-foreground mt-1" />}
                    <div
                      className={`rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === "user" && <User className="h-5 w-5 shrink-0 text-muted-foreground mt-1" />}
                  </div>
                ))}
                {chat.isPending && (
                  <div className="flex gap-2 justify-start">
                    <Bot className="h-5 w-5 shrink-0 text-muted-foreground mt-1" />
                    <div className="rounded-lg px-3 py-2 text-sm bg-muted flex items-center gap-2">
                      <Spinner className="h-3 w-3" /> Thinking…
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <div className="flex gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendQuestion();
                }
              }}
              placeholder="Ask about licenses, trainings, or staffing…"
              className="min-h-[44px] resize-none"
              rows={1}
            />
            <Button type="button" onClick={sendQuestion} disabled={chat.isPending || !question.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
