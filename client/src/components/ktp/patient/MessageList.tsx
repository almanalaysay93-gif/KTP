import { useState, type ReactNode } from "react";
import { ChevronDown, MailCheck } from "lucide-react";
import { StatusChip } from "@/components/clay";
import { MotionClayButton } from "@/components/motion";
import { cn } from "@/lib/utils";
import { patientDate, patientTime } from "./format";
import { FlatList, SectionCard } from "./SectionCard";
import type { ActionResult, MessageView, SectionState } from "./types";

export interface MessageListProps {
  items: MessageView[];
  today: string;
  state?: SectionState;
  onRetry?: () => void;
  /** Opening an unread message marks it read. */
  onRead: (id: string) => void;
  /** "I have read this": the KT unit sees the acknowledgment (spec D6). */
  onAcknowledge: (id: string) => Promise<ActionResult>;
  /** Rendered at the top of the section: the emergency band (COPY.md me.msg.heading). */
  emergency?: ReactNode;
  /** Link for "See all messages" in the empty state. */
  allHref?: string;
  id?: string;
  className?: string;
}

/** Unread marker: ink fill, peach text. Unread is not an alarm, so never red (DESIGN.md Don'ts). */
export function NewBadge({ children = "New" }: { children?: ReactNode }) {
  return (
    <span className="type-label inline-flex h-7 shrink-0 items-center rounded-full bg-ink px-2.5 text-peach">{children}</span>
  );
}

/**
 * One-way messages from the KT unit with read and acknowledge (spec 7.2). Each message is a
 * disclosure: the header button toggles the body (aria-expanded), no height animation.
 */
export function MessageList({
  items,
  today,
  state,
  onRetry,
  onRead,
  onAcknowledge,
  emergency,
  allHref = "#messages",
  id = "messages",
  className,
}: MessageListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const unread = items.filter((m) => !m.readAt).length;

  const toggle = (message: MessageView) => {
    const next = openId === message.id ? null : message.id;
    setOpenId(next);
    if (next && !message.readAt) onRead(message.id);
  };

  const acknowledge = async (messageId: string) => {
    setAcking(messageId);
    try {
      await onAcknowledge(messageId);
    } finally {
      setAcking(null);
    }
  };

  return (
    <SectionCard
      id={id}
      title="Messages"
      titleExtra={unread > 0 ? <NewBadge>{`${unread} new`}</NewBadge> : null}
      helper="You cannot reply here. For questions, please ask the KT unit."
      lead={emergency}
      state={state}
      onRetry={onRetry}
      className={className}
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="type-body-lg text-ink">No new messages.</p>
          <a href={allHref} className="clay-focus type-button rounded-xs text-brick underline underline-offset-4">
            See all messages
          </a>
        </div>
      ) : (
        <FlatList label="Messages from the KT unit">
          {items.map((message) => {
            const open = openId === message.id;
            const bodyId = `${id}-${message.id}-body`;
            const titleId = `${id}-${message.id}-title`;
            const isUnread = !message.readAt;
            return (
              <li key={message.id} className="py-1.5 first:pt-0 last:pb-0">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={bodyId}
                  onClick={() => toggle(message)}
                  className="clay-focus-inset flex min-h-14 w-full cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-(--dur-color) hover:bg-row-hover"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      {isUnread ? <NewBadge /> : null}
                      <span id={titleId} className={cn("type-body-lg text-ink", isUnread && "font-bold")}>
                        {message.title}
                      </span>
                    </span>
                    <span className="type-body-sm text-ink-muted">
                      From the KT unit, <span className="type-data">{patientDate(message.sentAt, today)}</span>{" "}
                      {patientTime(message.sentAt)}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    strokeWidth={1.75}
                    className={cn("mt-1 size-5 shrink-0 text-ink-muted", open && "rotate-180")}
                  />
                </button>
                <div id={bodyId} hidden={!open} className="flex flex-col items-start gap-3 px-2 pb-3 pt-1">
                  <p className="type-body-lg max-w-[60ch] text-ink">{message.body}</p>
                  {message.acknowledgedAt ? (
                    <StatusChip
                      status="done"
                      size="patient"
                      label={`Read on ${patientDate(message.acknowledgedAt, today)}`}
                    />
                  ) : (
                    <MotionClayButton
                      variant="secondary"
                      size="md"
                      icon={<MailCheck strokeWidth={1.75} />}
                      loading={acking === message.id}
                      aria-describedby={titleId}
                      onClick={() => acknowledge(message.id)}
                    >
                      I have read this
                    </MotionClayButton>
                  )}
                </div>
              </li>
            );
          })}
        </FlatList>
      )}
    </SectionCard>
  );
}
