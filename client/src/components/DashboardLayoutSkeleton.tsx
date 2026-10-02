import { Skeleton } from "./ui/skeleton";

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-col bg-background lg:flex-row">
      <header className="flex h-14 min-w-0 items-center gap-3 border-b border-border p-4 lg:hidden">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-4 w-28" />
      </header>
      {/* Sidebar skeleton */}
      <aside className="hidden w-[264px] shrink-0 flex-col gap-6 border-r border-border bg-background p-4 lg:flex">
        {/* Logo area */}
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Menu items */}
        <div className="space-y-2 px-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        {/* User profile area at bottom */}
        <div className="mt-auto">
          <div className="flex items-center gap-3 px-1">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-32" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="min-w-0 flex-1 space-y-4 p-4">
        {/* Content blocks */}
        <Skeleton className="h-12 w-48 rounded-lg" />
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </main>
    </div>
  );
}
