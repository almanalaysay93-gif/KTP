import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { MEMO_TYPE_LABELS, formatDate, type MemoType } from "@shared/nursetrack";
import { useState } from "react";

export function StaffMemoFeed() {
  const utils = trpc.useUtils();
  const { data: feed, isLoading } = trpc.staffAccount.myMemoFeed.useQuery();
  const [openId, setOpenId] = useState<number | null>(null);
  const markRead = trpc.staffAccount.markMemoRead.useMutation({
    onSuccess: () => {
      utils.staffAccount.myMemoFeed.invalidate();
      utils.staffAccount.unreadMemoCount.invalidate();
    },
  });

  const selected = feed?.find((m) => m.id === openId);

  const openMemo = (id: number) => {
    setOpenId(id);
    markRead.mutate({ memoId: id });
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <>
      <Card className="glass-card p-6 space-y-3">
        <h2 className="font-semibold">Memos</h2>
        {!feed?.length ? (
          <p className="text-sm text-muted-foreground">No memos yet.</p>
        ) : (
          <div className="space-y-2">
            {feed.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => openMemo(m.id)}
                className="w-full text-left border rounded-lg p-3 hover:bg-accent/40"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{MEMO_TYPE_LABELS[m.memoType as MemoType]}</Badge>
                  {!m.readAt ? <Badge>Unread</Badge> : null}
                  <span className="font-medium text-sm">{m.title}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(m.sentAt)}</p>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Sheet open={Boolean(openId)} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.title ?? "Memo"}</SheetTitle>
          </SheetHeader>
          {selected ? (
            <div className="mt-4 space-y-3">
              <Badge variant="outline">{MEMO_TYPE_LABELS[selected.memoType as MemoType]}</Badge>
              <p className="text-xs text-muted-foreground">{formatDate(selected.sentAt)}</p>
              <p className="text-sm whitespace-pre-wrap">{selected.body}</p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
