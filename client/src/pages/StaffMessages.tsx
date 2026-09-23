import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageSquarePlus,
  Send,
  Users,
  CheckCircle2,
  Clock,
  Eye,
  Archive,
  Edit2,
  Search,
  ShieldCheck,
  Building,
} from "lucide-react";
import { formatDate, nurseFullName } from "@shared/nursetrack";

export default function StaffMessages() {
  const [location] = useLocation();
  const utils = trpc.useUtils();

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);

  // Compose form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recipientMode, setRecipientMode] = useState<"all" | "area" | "staffType" | "specific">("all");
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [selectedStaffType, setSelectedStaffType] = useState<string>("Registered Nurse");
  const [selectedNurseIds, setSelectedNurseIds] = useState<number[]>([]);
  const [nurseSearch, setNurseSearch] = useState("");

  const { data: sentMessages, isLoading: isMessagesLoading } = trpc.staffFeed.listSentMessages.useQuery();
  const { data: composerData } = trpc.nurses.initial.useQuery(undefined, {
    enabled: isComposeOpen,
  });
  const allNurses = composerData?.nurses;
  const allAreas = composerData?.areas;
  const { data: messageDetail, isLoading: isDetailLoading } = trpc.staffFeed.getMessageDetail.useQuery(
    { id: selectedMessageId! },
    { enabled: selectedMessageId !== null }
  );

  // Check URL search params for pre-selecting nurseId
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const preselectId = searchParams.get("nurseId");
    if (preselectId) {
      const idNum = Number(preselectId);
      if (!isNaN(idNum) && idNum > 0) {
        setSelectedNurseIds([idNum]);
        setRecipientMode("specific");
        setIsComposeOpen(true);
      }
    }
  }, []);

  const createMutation = trpc.staffFeed.createMessage.useMutation({
    onSuccess: () => {
      toast.success("Message dispatched to staff feed");
      utils.staffFeed.listSentMessages.invalidate();
      setIsComposeOpen(false);
      resetComposeForm();
    },
    onError: (err) => toast.error(err.message || "Failed to send message"),
  });

  const updateMutation = trpc.staffFeed.updateMessage.useMutation({
    onSuccess: () => {
      toast.success("Message updated and revision incremented");
      utils.staffFeed.listSentMessages.invalidate();
      setEditingMessage(null);
    },
    onError: (err) => toast.error(err.message || "Failed to update message"),
  });

  const archiveMutation = trpc.staffFeed.archiveMessage.useMutation({
    onSuccess: () => {
      toast.success("Message archived");
      utils.staffFeed.listSentMessages.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to archive message"),
  });

  const resetComposeForm = () => {
    setTitle("");
    setBody("");
    setRecipientMode("all");
    setSelectedAreaId(null);
    setSelectedNurseIds([]);
  };

  // Compute final recipients based on mode
  const effectiveRecipientIds = useMemo(() => {
    if (!allNurses) return [];
    const activeStaff = allNurses.filter((n) => !n.archivedAt && n.employmentStatus === "Active");
    if (recipientMode === "all") {
      return activeStaff.map((n) => n.id);
    }
    if (recipientMode === "area" && selectedAreaId) {
      return activeStaff.filter((n) => n.currentAreaId === selectedAreaId).map((n) => n.id);
    }
    if (recipientMode === "staffType") {
      return activeStaff.filter((n) => n.staffType === selectedStaffType).map((n) => n.id);
    }
    return selectedNurseIds;
  }, [allNurses, recipientMode, selectedAreaId, selectedStaffType, selectedNurseIds]);

  const filteredNursesForSelect = useMemo(() => {
    if (!allNurses) return [];
    return allNurses
      .filter((n) => !n.archivedAt && n.employmentStatus === "Active")
      .filter((n) => {
        if (!nurseSearch) return true;
        const full = `${n.firstName} ${n.lastName} ${n.employeeId || ""}`.toLowerCase();
        return full.includes(nurseSearch.toLowerCase());
      });
  }, [allNurses, nurseSearch]);

  const handleSend = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }
    if (effectiveRecipientIds.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      recipientNurseIds: effectiveRecipientIds,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Messages & Notices</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Publish announcements and direct notices to nurse staff feeds with read and acknowledgment tracking.
          </p>
        </div>

        <Button onClick={() => setIsComposeOpen(true)} className="bg-sky-600 hover:bg-sky-700 text-white shrink-0">
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          Compose Message
        </Button>
      </div>

      {/* Sent Messages List */}
      {isMessagesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : !sentMessages || sentMessages.length === 0 ? (
        <Card className="glass-card p-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto text-sky-500 mb-2 opacity-80" />
          <h3 className="font-semibold text-base text-foreground">No Messages Sent Yet</h3>
          <p className="text-xs mt-1">
            Use the Compose button above to send your first message to staff feeds.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sentMessages.map((msg) => (
            <Card key={msg.id} className="glass-card">
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-foreground">{msg.title}</h3>
                    {msg.revision > 1 && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                        Revision {msg.revision}
                      </Badge>
                    )}
                    {msg.archivedAt && (
                      <Badge variant="outline" className="text-[10px] text-slate-500">
                        Archived
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                    {msg.body}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-1">
                    <span>Sent: {formatDate(msg.createdAt)}</span>
                    <span>By: {msg.senderName || "Supervisor"}</span>
                    <Badge variant="outline" className="text-[11px] bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      Read: {msg.readCount} / {msg.recipientCount}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Acknowledged: {msg.ackCount} / {msg.recipientCount}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedMessageId(msg.id)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1 text-sky-600" />
                    Recipients
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setEditingMessage({ id: msg.id, title: msg.title, body: msg.body })}
                  >
                    <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                  </Button>

                  {!msg.archivedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => archiveMutation.mutate({ id: msg.id })}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Compose Message Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-2 space-y-0 text-left">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="sm:hidden h-8 px-2 -ml-2 text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
              onClick={() => setIsComposeOpen(false)}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            <div className="space-y-0.5">
              <DialogTitle className="text-lg font-bold">Compose Supervisor Message</DialogTitle>
              <DialogDescription className="text-xs">
                This message will appear in the designated nurses' portal feeds.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Message Title</label>
              <Input
                placeholder="Important clinical reminder..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Message Content</label>
              <Textarea
                placeholder="Write your announcement or notice here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={5000}
                className="text-xs"
              />
            </div>

            {/* Recipient Targeting Mode */}
            <div className="space-y-2 p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50">
              <label className="font-semibold text-foreground block">Recipients</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={recipientMode === "all" ? "default" : "outline"}
                  className="text-xs h-8"
                  onClick={() => setRecipientMode("all")}
                >
                  All Staff
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={recipientMode === "area" ? "default" : "outline"}
                  className="text-xs h-8"
                  onClick={() => setRecipientMode("area")}
                >
                  By Area
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={recipientMode === "staffType" ? "default" : "outline"}
                  className="text-xs h-8"
                  onClick={() => setRecipientMode("staffType")}
                >
                  By Role
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={recipientMode === "specific" ? "default" : "outline"}
                  className="text-xs h-8"
                  onClick={() => setRecipientMode("specific")}
                >
                  Specific Staff
                </Button>
              </div>

              {recipientMode === "area" && (
                <div className="pt-2">
                  <Select
                    value={selectedAreaId ? String(selectedAreaId) : ""}
                    onValueChange={(val) => setSelectedAreaId(Number(val))}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Select clinical area..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(allAreas || []).map((a) => (
                        <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {recipientMode === "staffType" && (
                <div className="pt-2">
                  <Select value={selectedStaffType} onValueChange={setSelectedStaffType}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Select staff role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Registered Nurse" className="text-xs">Registered Nurse (RN)</SelectItem>
                      <SelectItem value="Nursing Attendant" className="text-xs">Nursing Attendant (NA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {recipientMode === "specific" && (
                <div className="pt-2 space-y-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search nurse by name or employee ID..."
                      value={nurseSearch}
                      onChange={(e) => setNurseSearch(e.target.value)}
                      className="text-xs h-8 pl-8"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto border rounded-md p-2 space-y-1 bg-background">
                    {filteredNursesForSelect.map((n) => {
                      const isChecked = selectedNurseIds.includes(n.id);
                      return (
                        <div
                          key={n.id}
                          className="flex items-center gap-2 p-1 rounded-sm hover:bg-accent/50 cursor-pointer"
                          onClick={() => {
                            setSelectedNurseIds((prev) =>
                              isChecked ? prev.filter((id) => id !== n.id) : [...prev, n.id]
                            );
                          }}
                        >
                          <Checkbox checked={isChecked} />
                          <span className="text-xs text-foreground">
                            {nurseFullName(n)} ({n.staffType === "Registered Nurse" ? "RN" : "NA"})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground pt-1">
                Targeting: <strong>{effectiveRecipientIds.length}</strong> nurse recipient(s)
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs"
              disabled={createMutation.isPending || effectiveRecipientIds.length === 0}
              onClick={handleSend}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {createMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipient Audit Dialog */}
      <Dialog open={selectedMessageId !== null} onOpenChange={(open) => !open && setSelectedMessageId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-2 space-y-0 text-left">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="sm:hidden h-8 px-2 -ml-2 text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
              onClick={() => setSelectedMessageId(null)}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            <div className="space-y-0.5">
              <DialogTitle className="text-base font-bold">Recipient Read & Acknowledgment Status</DialogTitle>
              <DialogDescription className="text-xs">
                Audited status for message: <strong>{messageDetail?.title}</strong>
              </DialogDescription>
            </div>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !messageDetail ? (
            <p className="text-xs text-muted-foreground py-4">Details unavailable.</p>
          ) : (
            <div className="space-y-3 py-2 text-xs">
              <div className="flex gap-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Total Recipients</span>
                  <span className="font-semibold text-foreground">{messageDetail.recipients.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Read</span>
                  <span className="font-semibold text-sky-600">
                    {messageDetail.recipients.filter((r: any) => r.isRead).length}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Acknowledged</span>
                  <span className="font-semibold text-emerald-600">
                    {messageDetail.recipients.filter((r: any) => r.acknowledgedAt != null).length}
                  </span>
                </div>
              </div>

              <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                {messageDetail.recipients.map((r: any) => (
                  <div key={r.nurseId} className="p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-foreground block">
                        {r.firstName} {r.lastName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">ID: {r.employeeId || "—"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.isRead ? (
                        <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                          Read
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          Unread
                        </Badge>
                      )}

                      {r.acknowledgedAt ? (
                        <Badge className="text-[10px] bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Ack
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-300">
                          Pending Ack
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSelectedMessageId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={editingMessage !== null} onOpenChange={(open) => !open && setEditingMessage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex flex-row items-center gap-2 space-y-0 text-left">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="sm:hidden h-8 px-2 -ml-2 text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
              onClick={() => setEditingMessage(null)}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            <div className="space-y-0.5">
              <DialogTitle className="text-base font-bold">Edit Message</DialogTitle>
              <DialogDescription className="text-xs">
                Editing increments the message revision and requires nurses to re-read and re-acknowledge.
              </DialogDescription>
            </div>
          </DialogHeader>

          {editingMessage && (
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Title</label>
                <Input
                  value={editingMessage.title}
                  onChange={(e) => setEditingMessage({ ...editingMessage, title: e.target.value })}
                  maxLength={160}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Content</label>
                <Textarea
                  value={editingMessage.body}
                  onChange={(e) => setEditingMessage({ ...editingMessage, body: e.target.value })}
                  rows={5}
                  maxLength={5000}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingMessage(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs"
              disabled={updateMutation.isPending || !editingMessage?.title?.trim() || !editingMessage?.body?.trim()}
              onClick={() => {
                if (editingMessage) {
                  updateMutation.mutate({
                    id: editingMessage.id,
                    title: editingMessage.title.trim(),
                    body: editingMessage.body.trim(),
                  });
                }
              }}
            >
              Save & Increment Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
