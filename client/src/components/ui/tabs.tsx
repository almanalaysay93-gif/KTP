import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLDivElement);

  const [indicator, setIndicator] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
  }>({ x: 0, y: 0, width: 0, height: 0, opacity: 0 });

  const updateIndicator = React.useCallback(() => {
    const list = innerRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-state="active"]');
    if (active) {
      setIndicator({
        x: active.offsetLeft,
        y: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
        opacity: 1,
      });
    } else {
      setIndicator((prev) => ({ ...prev, opacity: 0 }));
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    updateIndicator();

    const node = innerRef.current;
    if (!node) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "data-state") {
          updateIndicator();
          break;
        }
      }
    });

    observer.observe(node, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state"],
    });

    const resizeObserver = new ResizeObserver(() => {
      updateIndicator();
    });
    resizeObserver.observe(node);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [updateIndicator]);

  return (
    <TabsPrimitive.List
      ref={innerRef}
      data-slot="tabs-list"
      className={cn(
        "relative bg-muted text-muted-foreground inline-flex min-h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    >
      <div
        data-slot="tabs-indicator"
        className="absolute top-0 left-0 rounded-md bg-background dark:bg-card shadow-xs transition-all duration-200 ease-out pointer-events-none z-0 border border-border/40"
        style={{
          transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
          width: `${indicator.width}px`,
          height: `${indicator.height}px`,
          opacity: indicator.opacity,
          visibility: indicator.opacity === 0 ? "hidden" : "visible",
        }}
        aria-hidden="true"
      />
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors duration-200 text-muted-foreground hover:text-foreground data-[state=active]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none data-[state=inactive]:hidden data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200",
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
