import { useState } from "react";
import { Link } from "wouter";
import StaffLayout from "@/components/StaffLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  ChevronRight,
  Sparkles,
  Info,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { formatDate } from "@shared/nursetrack";

export default function StaffFeed() {
  const utils = trpc.useUtils();
  const { data: messages, isLoading: isMsgLoading } = trpc.staffFeed.myFeed.useQuery();
  const { data: activities, isLoading: isActLoading } = trpc.staffFeed.myActivity.useQuery({ limit: 10 });
  const { data: calendarItems, isLoading: isCalLoading } = trpc.staffAccount.myTrainingCalendar.useQuery({
    status: "Scheduled",
  });

  const markReadMutation = trpc.staffFeed.markRead.useMutation({
    onSuccess: () => {
      utils.staffFeed.unreadCount.invalidate();
      utils.staffFeed.myFeed.invalidate();
    },
  });

  const ackMutation = trpc.staffFeed.acknowledge.useMutation({
    onSuccess: () => {
      toast.success("Message acknowledged");
      utils.staffFeed.myFeed.invalidate();
      utils.staffFeed.unreadCount.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to acknowledge");
    },
  });

  // Handle clicking a message card to mark as read
  const handleCardClick = (msg: any) => {
    if (msg.isUnread) {
      markReadMutation.mutate({ messageId: msg.id });
    }
  };

  const nextTraining = calendarItems && calendarItems.length > 0 ? calendarItems[0] : null;

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Welcome & Next Training banner */}
        {nextTraining && (
          <Card className="glass-card border-sky-300 dark:border-sky-800 bg-linear-to-r from-sky-50 to-indigo-50/50 dark:from-sky-950/20 dark:to-indigo-950/10">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-sky-600 text-white hover:bg-sky-700 text-xs">Upcoming Training</Badge>
                  {nextTraining.staffResponse === "Pending" && (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-xs">
                      Confirmation Required
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-base text-foreground">{nextTraining.trainingName}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-sky-600" />
                  {nextTraining.startDateStr} {nextTraining.startTime ? `at ${nextTraining.startTime}` : ""}
                  {nextTraining.venue ? ` \u00B7 ${nextTraining.venue}` : ""}
                </p>
              </div>

              <Link href="/me/calendar">
                <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white shrink-0">
                  Open Calendar
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed: Supervisor Messages */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Supervisor Messages</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {messages ? `${messages.length} message${messages.length === 1 ? "" : "s"}` : "Loading..."}
              </span>
            </div>

            {isMsgLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-28 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
              </div>
            ) : !messages || messages.length === 0 ? (
              <Card className="glass-card p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="font-medium text-sm text-foreground">You are all caught up!</p>
                <p className="text-xs mt-1">No announcements or notices from your clinical supervisor.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <Card
                    key={msg.id}
                    onClick={() => handleCardClick(msg)}
                    className={`transition-all duration-150 cursor-pointer ${
                      msg.isUnread
                        ? "border-sky-400 dark:border-sky-700 bg-sky-50/40 dark:bg-sky-950/20 shadow-xs"
                        : "hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {msg.isUnread && (
                            <span className="h-2 w-2 rounded-full bg-sky-600 shrink-0" title="Unread" />
                          )}
                          <CardTitle className="text-sm font-semibold">{msg.title}</CardTitle>
                          {msg.isEdited && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 py-0 h-4">
                              Edited (rev {msg.revision})
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground">
                        From: {msg.senderName || "Clinical Supervisor"}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {msg.body}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t text-xs">
                        {msg.acknowledgedAt ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                            <ShieldCheck className="h-4 w-4" />
                            Acknowledged
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-sky-500 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50"
                            disabled={ackMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              ackMutation.mutate({ messageId: msg.id, revision: msg.revision });
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Acknowledge Notice
                          </Button>
                        )}

                        <span className="text-[11px] text-muted-foreground">
                          {msg.isUnread ? "Click to mark as read" : "Read"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: In-App Activity & Quick Links */}
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold tracking-tight">Recent Activity</h3>
              </div>

              {isActLoading ? (
                <Skeleton className="h-32 w-full rounded-lg" />
              ) : !activities || activities.length === 0 ? (
                <Card className="glass-card p-5 text-center text-xs text-muted-foreground">
                  No recent training activities recorded.
                </Card>
              ) : (
                <Card className="glass-card divide-y">
                  {activities.map((act) => (
                    <div key={act.id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{act.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(act.createdAt)}
                        </span>
                      </div>
                      {act.message && (
                        <p className="text-muted-foreground text-[11px] leading-tight">
                          {act.message}
                        </p>
                      )}
                    </div>
                  ))}
                </Card>
              )}
            </div>

            {/* Quick Actions Card */}
            <Card className="glass-card p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff Actions</h4>
              <div className="grid grid-cols-1 gap-2">
                <Link href="/me/calendar">
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                    <Calendar className="h-3.5 w-3.5 mr-2 text-sky-600" />
                    View Training Calendar
                  </Button>
                </Link>
                <Link href="/me/profile">
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                    <Info className="h-3.5 w-3.5 mr-2 text-indigo-600" />
                    Review License & Profile
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
