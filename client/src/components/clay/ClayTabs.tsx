import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/** Radix tabs in clay: sunken pill track, active tab is a raised surface-2 pill. Arrow keys, Home, End from Radix. */
export const ClayTabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(function ClayTabs({ className, ...rest }, ref) {
  return <TabsPrimitive.Root ref={ref} className={cn("flex flex-col gap-4", className)} {...rest} />;
});

export const ClayTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function ClayTabsList({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "clay-sunken inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full p-1",
        className,
      )}
      {...rest}
    />
  );
});

export const ClayTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function ClayTabsTrigger({ className, ...rest }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "clay-tab clay-focus-inset clay-press inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 type-button text-ink-muted",
        "transition-colors duration-(--dur-color) hover:text-ink [&.is-hover]:text-ink [&_svg]:size-5",
        "data-[disabled]:cursor-not-allowed data-[disabled]:text-line-strong",
        className,
      )}
      {...rest}
    />
  );
});

export const ClayTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function ClayTabsContent({ className, ...rest }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn("clay-focus rounded-md", className)} {...rest} />;
});
