import * as React from "react";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClayAvatarSize = 32 | 40 | 56 | 72;
export type ClayAvatarKind = "recipient" | "donor" | "neutral";

export interface ClayAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name. "Last, First" or "First Last". Used for initials and the accessible name. */
  name: string;
  src?: string;
  size?: ClayAvatarSize;
  /** recipient: peach tint + maroon initials; donor: sage tint + ink; neutral: surface-2 + ink */
  kind?: ClayAvatarKind;
  loading?: boolean;
  /** Hide from screen readers when the name is already visible next to it. */
  decorative?: boolean;
}

const SIZES: Record<ClayAvatarSize, string> = {
  32: "size-8 text-[13px]",
  40: "size-10 text-[15px]",
  56: "size-14 text-xl",
  72: "size-18 text-[26px]",
};

const KINDS: Record<ClayAvatarKind, string> = {
  recipient: "bg-peach-tint text-maroon",
  donor: "bg-sage-tint text-ink",
  neutral: "bg-surface-2 text-ink",
};

export function initialsOf(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.includes(",")) {
    const [last, first = ""] = trimmed.split(",").map((part) => part.trim());
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }
  const words = trimmed.split(/\s+/);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

export const ClayAvatar = React.forwardRef<HTMLSpanElement, ClayAvatarProps>(function ClayAvatar(
  { name, src, size = 40, kind = "neutral", loading = false, decorative = false, className, ...rest },
  ref,
) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  const showPhoto = Boolean(src) && !failed && !loading;
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : showPhoto
      ? {}
      : { role: "img" as const, "aria-label": name };

  return (
    <span
      ref={ref}
      data-kind={kind}
      className={cn(
        "clay-avatar relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-sans font-bold leading-none",
        SIZES[size],
        loading ? "clay-sunken" : KINDS[kind],
        className,
      )}
      {...a11y}
      {...rest}
    >
      {loading ? null : showPhoto ? (
        <img
          src={src}
          alt={decorative ? "" : name}
          className="size-full object-cover"
          onError={() => setFailed(true)}
          decoding="async"
        />
      ) : (
        <span aria-hidden>{initialsOf(name)}</span>
      )}
    </span>
  );
});

export interface ClayAvatarPairProps extends React.HTMLAttributes<HTMLSpanElement> {
  recipient: { name: string; src?: string };
  donor: { name: string; src?: string };
  size?: ClayAvatarSize;
}

/** Recipient and linked donor: two overlapped avatars with a sage exchange arrow. */
export const ClayAvatarPair = React.forwardRef<HTMLSpanElement, ClayAvatarPairProps>(function ClayAvatarPair(
  { recipient, donor, size = 40, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      role="img"
      aria-label={`Recipient ${recipient.name}, linked donor ${donor.name}`}
      className={cn("relative inline-flex items-center", className)}
      {...rest}
    >
      <ClayAvatar decorative name={recipient.name} src={recipient.src} kind="recipient" size={size} />
      <ClayAvatar decorative name={donor.name} src={donor.src} kind="donor" size={size} className="-ml-3" />
      <span
        aria-hidden
        className="clay-1 absolute -bottom-1 left-1/2 inline-flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-surface-2 text-sage"
      >
        <ArrowLeftRight className="size-3.5" strokeWidth={2} />
      </span>
    </span>
  );
});
