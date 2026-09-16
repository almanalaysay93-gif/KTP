import { useState } from "react";
import StaffLayout from "@/components/StaffLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

export default function StaffTrainingCalendar() {
  const utils = trpc.useUtils();
  const [viewMode, setViewMode] = useState<"agenda" | "month">("agenda");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isCannotAttendOpen, setIsCannotAttendOpen] = useState(false);
  const [cannotAttendReason, setCannotAttendReason] = useState("");
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ base64: string; name: string; mimeType: string } | null>(null);

  const { data: calendarItems, isLoading, error, refetch } = trpc.staffAccount.myTrainingCalendar.useQuery(undefined, { retry: false });

  const respondMutation = trpc.staffAccount.respondToTraining.useMutation({
    onSuccess: () => {
      toast.success("Response recorded successfully");
      utils.staffAccount.myTrainingCalendar.invalidate();
      if (selectedItem) {
        setSelectedItem((prev: any) => ({
          ...prev,
          staffResponse: cannotAttendReason ? "Cannot attend" : "Confirmed",
          staffResponseReason: cannotAttendReason || null,
        }));
      }
      setIsCannotAttendOpen(false);
      setCannotAttendReason("");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit response");
    },
  });

  const evidenceMutation = trpc.staffAccount.submitTrainingEvidence.useMutation({
    onSuccess: () => {
      toast.success("Training completion evidence submitted for supervisor review");
      utils.staffAccount.myTrainingCalendar.invalidate();
      if (selectedItem) {
        setSelectedItem((prev: any) => ({
          ...prev,
          evidenceStatus: "Submitted",
        }));
      }
      setIsEvidenceOpen(false);
      setSelectedFile(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit evidence");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size cannot exceed 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setSelectedFile({
        base64,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
      });
    };
    reader.readAsDataURL(file);
  };

  const getStatusBadge = (item: any) => {
    if (item.status === "Cancelled") {
      return <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600">Cancelled</Badge>;
    }
    if (item.status === "Completed") {
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Completed</Badge>;
    }
    if (item.staffResponse === "Confirmed") {
      return <Badge className="bg-teal-600 text-white hover:bg-teal-700">Attendance Confirmed</Badge>;
    }
    if (item.staffResponse === "Cannot attend") {
      return <Badge className="bg-amber-600 text-white hover:bg-amber-700">Cannot Attend</Badge>;
    }
    return <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30">Confirmation Pending</Badge>;
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Build calendar matrix
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = currentMonth.toLocaleString("en-US", { month: "long", year: "numeric" });

  const days: { day: number; dateStr: string; items: any[] }[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    const dayItems = (calendarItems || []).filter((it) => {
      const start = it.startDateStr;
      const end = it.endDateStr || start;
      return dStr >= start && dStr <= end;
    });
    days.push({ day: i, dateStr: dStr, items: dayItems });
  }

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Assigned Training Calendar</h2>
            <p className="text-xs text-muted-foreground">
              Review assigned schedules, confirm your attendance, and upload completion certificates.
            </p>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-auto">
            <TabsList className="grid grid-cols-2 w-48">
              <TabsTrigger value="agenda" className="text-xs">Agenda</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {error ? (
          <Card className="glass-card p-6 space-y-3" role="alert">
            <p>Could not load your training calendar. Please try again.</p>
            <Button onClick={() => void refetch()}>Retry</Button>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : !calendarItems || calendarItems.length === 0 ? (
          <Card className="glass-card p-10 text-center text-muted-foreground">
            <CalendarIcon className="h-10 w-10 mx-auto text-sky-500 mb-2 opacity-80" />
            <h3 className="font-semibold text-base text-foreground">No Trainings Scheduled</h3>
            <p className="text-xs mt-1">You have no upcoming or past assigned trainings on your record.</p>
          </Card>
        ) : viewMode === "agenda" ? (
          /* Agenda / List View */
          <div className="space-y-3">
            {calendarItems.map((item) => (
              <Card
                key={item.assignmentId}
                onClick={() => setSelectedItem(item)}
                className="glass-card hover:border-sky-400 dark:hover:border-sky-700 transition cursor-pointer"
              >
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(item)}
                      {item.evidenceRequired && (
                        <Badge variant="outline" className="text-[10px] border-slate-300">
                          Evidence Required
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-bold text-base text-foreground">{item.trainingName}</h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5 text-sky-600" />
                        {item.startDateStr}
                        {item.endDateStr && item.endDateStr !== item.startDateStr ? ` to ${item.endDateStr}` : ""}
                      </span>
                      {item.startTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-indigo-600" />
                          {item.startTime}
                          {item.endTime ? ` - ${item.endTime}` : ""}
                        </span>
                      )}
                      {item.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                          {item.venue}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button size="sm" variant="outline" className="shrink-0 text-xs">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Month Grid View */
          <Card className="glass-card p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground">{monthLabel}</h3>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground pb-2 border-b">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[90px] p-1 bg-slate-50/30 dark:bg-slate-900/10 rounded-sm" />
              ))}

              {days.map((d) => (
                <div
                  key={d.dateStr}
                  className="min-h-[70px] sm:min-h-[90px] p-1 border rounded-sm bg-background flex flex-col justify-between hover:bg-accent/40 transition"
                >
                  <span className="text-xs font-medium text-muted-foreground text-left pl-1">{d.day}</span>
                  <div className="space-y-1 mt-1">
                    {d.items.map((it) => (
                      <div
                        key={it.assignmentId}
                        onClick={() => setSelectedItem(it)}
                        className="text-[10px] sm:text-[11px] truncate px-1 py-0.5 rounded-xs bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-medium cursor-pointer hover:underline"
                        title={it.trainingName}
                      >
                        {it.trainingName}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Selected Item Detail Dialog */}
        <Dialog open={selectedItem !== null} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="max-w-md">
            {selectedItem && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(selectedItem)}
                  </div>
                  <DialogTitle className="text-base font-bold">{selectedItem.trainingName}</DialogTitle>
                  <DialogDescription className="text-xs">
                    Schedule version {selectedItem.scheduleVersion}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 text-xs py-2">
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Dates</span>
                      <span className="font-semibold text-foreground">
                        {selectedItem.startDateStr}
                        {selectedItem.endDateStr && selectedItem.endDateStr !== selectedItem.startDateStr ? ` to ${selectedItem.endDateStr}` : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Time</span>
                      <span className="font-semibold text-foreground">
                        {selectedItem.startTime ? `${selectedItem.startTime}${selectedItem.endTime ? ` - ${selectedItem.endTime}` : ""}` : "Not specified"}
                      </span>
                    </div>
                    {selectedItem.venue && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground block text-[11px]">Venue</span>
                        <span className="font-semibold text-foreground">{selectedItem.venue}</span>
                      </div>
                    )}
                  </div>

                  {selectedItem.instructions && (
                    <div className="space-y-1">
                      <span className="font-semibold text-foreground">Special Instructions</span>
                      <p className="text-muted-foreground bg-slate-50 dark:bg-slate-900 p-2.5 rounded-md border text-xs">
                        {selectedItem.instructions}
                      </p>
                    </div>
                  )}

                  {/* Attendance Response Section */}
                  <div className="p-3 rounded-lg border bg-card space-y-2">
                    <span className="font-semibold text-foreground block">Your Attendance Response</span>
                    {selectedItem.staffResponse === "Confirmed" ? (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Attendance confirmed for this training
                      </div>
                    ) : selectedItem.staffResponse === "Cannot attend" ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                          <XCircle className="h-4 w-4" />
                          Marked as cannot attend
                        </div>
                        {selectedItem.staffResponseReason && (
                          <p className="text-[11px] text-muted-foreground pl-6">
                            Reason: {selectedItem.staffResponseReason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Please indicate whether you can attend so unit coverage can be planned.
                      </p>
                    )}

                    {selectedItem.status === "Scheduled" && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                          disabled={respondMutation.isPending || selectedItem.staffResponse === "Confirmed"}
                          onClick={() =>
                            respondMutation.mutate({
                              assignmentId: selectedItem.assignmentId,
                              scheduleVersion: selectedItem.scheduleVersion,
                              response: "confirmed",
                            })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-xs h-8"
                          disabled={respondMutation.isPending}
                          onClick={() => setIsCannotAttendOpen(true)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Cannot Attend
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Evidence Section */}
                  {selectedItem.evidenceRequired && (
                    <div className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Completion Certificate / Evidence</span>
                        <Badge variant="outline" className="text-[10px]">
                          Status: {selectedItem.evidenceStatus}
                        </Badge>
                      </div>

                      {selectedItem.evidenceStatus === "Verified" ? (
                        <p className="text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5 font-medium">
                          <FileCheck className="h-4 w-4" />
                          Certificate verified by supervisor
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-muted-foreground text-xs">
                            Upload your official attendance certificate or completion proof.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-8"
                            onClick={() => setIsEvidenceOpen(true)}
                          >
                            <Upload className="h-3.5 w-3.5 mr-1.5 text-sky-600" />
                            {selectedItem.evidenceStatus === "Submitted" ? "Upload Revised Evidence" : "Upload Evidence"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Cannot Attend Reason Modal */}
        <Dialog open={isCannotAttendOpen} onOpenChange={setIsCannotAttendOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Reason for Inability to Attend</DialogTitle>
              <DialogDescription className="text-xs">
                Your supervisor will be notified to assist with coverage or rescheduling.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Textarea
                placeholder="Explain why you cannot attend (1 to 1000 characters)..."
                value={cannotAttendReason}
                onChange={(e) => setCannotAttendReason(e.target.value)}
                className="text-xs h-24"
                maxLength={1000}
              />
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsCannotAttendOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                disabled={!cannotAttendReason.trim() || respondMutation.isPending}
                onClick={() => {
                  if (selectedItem) {
                    respondMutation.mutate({
                      assignmentId: selectedItem.assignmentId,
                      scheduleVersion: selectedItem.scheduleVersion,
                      response: "cannot_attend",
                      reason: cannotAttendReason.trim(),
                    });
                  }
                }}
              >
                Submit Reason
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Evidence Upload Modal */}
        <Dialog open={isEvidenceOpen} onOpenChange={setIsEvidenceOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Submit Completion Evidence</DialogTitle>
              <DialogDescription className="text-xs">
                Upload a certificate or attendance document (PDF, PNG, JPG up to 10 MB).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={handleFileChange}
                className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 dark:file:bg-sky-950 dark:file:text-sky-300 w-full"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground truncate">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEvidenceOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs"
                disabled={!selectedFile || evidenceMutation.isPending}
                onClick={() => {
                  if (selectedItem && selectedFile) {
                    evidenceMutation.mutate({
                      assignmentId: selectedItem.assignmentId,
                      fileBase64: selectedFile.base64,
                      fileName: selectedFile.name,
                      mimeType: selectedFile.mimeType,
                    });
                  }
                }}
              >
                Upload & Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StaffLayout>
  );
}
