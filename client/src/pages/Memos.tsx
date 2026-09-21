import { AreaSelect } from "@/components/nursetrack/AreaSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { MEMO_TYPE_LABELS, MEMO_TYPES, formatDate, type MemoType } from "@shared/nursetrack";
import { Megaphone } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function MemosPage() {
  const utils = trpc.useUtils();
  const { data: memos, isLoading } = trpc.memos.list.useQuery();
  const [memoType, setMemoType] = useState<MemoType>("department");
  const [areaId, setAreaId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [retractId, setRetractId] = useState<number | null>(null);

  const previewInput = useMemo(
    () => ({
      memoType,
      areaId: memoType === "department" && areaId ? Number(areaId) : undefined,
    }),
    [memoType, areaId],
  );
  const previewEnabled = memoType !== "department" || Boolean(areaId);
  const { data: preview } = trpc.memos.previewAudience.useQuery(previewInput, { enabled: previewEnabled });
  const { data: receipts } = trpc.memos.receipts.useQuery({ id: selectedId ?? 0 }, { enabled: Boolean(selectedId) });
  const selected = memos?.find((m) => m.id === selectedId);

  const create = trpc.memos.create.useMutation({
    onSuccess: () => {
      toast.success("Memo sent to the staff feed.");
      utils.memos.list.invalidate();
      setTitle("");
      setBody("");
    },
    onError: (e) => toast.error(e.message),
  });
  const retract = trpc.memos.retract.useMutation({
    onSuccess: () => {
      toast.success("Memo retracted.");
      utils.memos.list.invalidate();
      setRetractId(null);
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const send = () => {
    if (previewEnabled && preview?.count === 0) {
      toast.error("No eligible staff for this memo.");
      return;
    }
    create.mutate({
      memoType,
      areaId: memoType === "department" ? Number(areaId) : undefined,
      title: title.trim(),
      body: body.trim(),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Memos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send a department, nursing, or hospital memo to the staff feed.
        </p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Memo type</Label>
              <Select
                value={memoType}
                onValueChange={(v) => {
                  setMemoType(v as MemoType);
                  if (v !== "department") setAreaId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMO_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {MEMO_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {memoType === "department" ? (
              <div className="space-y-2">
                <Label>Area</Label>
                <AreaSelect value={areaId} onValueChange={setAreaId} activeOnly placeholder="Select area" />
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo-title">Title</Label>
            <Input id="memo-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={256} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo-body">Message</Label>
            <Textarea id="memo-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={8000} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {previewEnabled
                ? `${preview?.count ?? 0} staff will receive this memo${preview?.areaName ? ` in ${preview.areaName}` : ""}.`
                : "Select an area to see who will receive this memo."}
            </p>
            <Button
              onClick={send}
              disabled={!title.trim() || !body.trim() || (memoType === "department" && !areaId) || create.isPending}
            >
              <Megaphone className="h-4 w-4 mr-1.5" />
              {create.isPending ? "Sending..." : "Send memo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !memos?.length ? (
        <p className="text-sm text-muted-foreground">No memos sent yet.</p>
      ) : (
        <div className="space-y-2">
          {memos.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className="w-full text-left glass-card p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{MEMO_TYPE_LABELS[m.memoType as MemoType]}</Badge>
                  {m.status === "retracted" ? <Badge variant="destructive">Retracted</Badge> : null}
                  <span className="font-medium truncate">{m.title}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(m.sentAt)}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {m.read}/{m.total} read · {m.notLinked} not linked
              </p>
            </button>
          ))}
        </div>
      )}

      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.title ?? "Memo"}</SheetTitle>
          </SheetHeader>
          {selected ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm whitespace-pre-wrap">{selected.body}</p>
              <p className="text-sm text-muted-foreground">
                {selected.read}/{selected.total} read · {selected.unread} unread · {selected.notLinked} not linked
              </p>
              {selected.status === "sent" ? (
                <Button variant="outline" onClick={() => setRetractId(selected.id)}>
                  Retract memo
                </Button>
              ) : null}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Receipts</h3>
                {!receipts?.length ? (
                  <p className="text-sm text-muted-foreground">No recipients.</p>
                ) : (
                  receipts.map((r) => (
                    <div key={r.nurseId} className="flex items-center justify-between gap-2 text-sm border rounded-md p-2">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.areaName ?? "Unassigned"}</p>
                      </div>
                      <Badge variant={r.readAt ? "default" : r.linkedAtSend ? "secondary" : "outline"}>
                        {r.readAt ? "Read" : r.linkedAtSend ? "Unread" : "Not linked"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(retractId)} onOpenChange={(open) => !open && setRetractId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retract this memo?</AlertDialogTitle>
            <AlertDialogDescription>
              Staff will no longer see it in their feed. Receipts stay on this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => retractId && retract.mutate({ id: retractId })}
              disabled={retract.isPending}
            >
              Retract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
