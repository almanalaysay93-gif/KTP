import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Bell, Calendar, User, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface StaffLayoutProps {
  children: React.ReactNode;
}

export default function StaffLayout({ children }: StaffLayoutProps) {
  const { logout } = useAuth();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: linkData, isLoading: isLinkLoading } = trpc.staffAccount.myLink.useQuery();
  const { data: profile } = trpc.staffAccount.myProfile.useQuery(undefined, {
    enabled: Boolean(linkData?.linked),
  });
  const { data: unreadData } = trpc.staffFeed.unreadCount.useQuery(undefined, {
    enabled: Boolean(linkData?.linked),
    refetchInterval: 30000,
  });
  const { data: unreadMemoCount } = trpc.staffAccount.unreadMemoCount.useQuery(undefined, {
    enabled: Boolean(linkData?.linked),
    refetchInterval: 30000,
  });
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    await logout();
    utils.staffAccount.myLink.setData(undefined, undefined);
    utils.staffAccount.myProfile.setData(undefined, undefined);
    utils.staffAccount.myMemoFeed.setData(undefined, undefined);
    utils.staffAccount.unreadMemoCount.setData(undefined, undefined);
    utils.staffFeed.myFeed.setData(undefined, undefined);
    utils.staffFeed.unreadCount.setData(undefined, undefined);
    navigate("/staff-signin");
  };

  if (!isLinkLoading && !linkData?.linked) {
    navigate("/staff-signin");
    return null;
  }

  const unreadCount = (unreadData?.count ?? 0) + (unreadMemoCount ?? 0);
  const isFeed = location === "/me" || location === "/me/";
  const isCalendar = location === "/me/calendar";
  const isProfile = location === "/me/profile";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-3">
            <img
              src="/branding/ots-mark.png"
              alt="Organ Transplant Services"
              className="h-9 w-9 object-contain rounded-md bg-white shadow-xs shrink-0"
            />
            <div>
              <span className="font-bold text-base tracking-tight block">SKTI NurseTrack</span>
              {profile && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {profile.firstName} {profile.lastName} &middot; {profile.staffType}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toggleTheme && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive flex items-center gap-1.5 h-8 px-2 sm:px-3 text-xs sm:text-sm font-medium"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </Button>
          </div>
        </div>

        {/* Staff navigation bar */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center border-t sm:border-t-0 gap-1 sm:gap-2 overflow-x-auto py-1.5">
          <Link href="/me">
            <Button
              variant={isFeed ? "default" : "ghost"}
              size="sm"
              className={`relative text-xs sm:text-sm font-medium rounded-md ${
                isFeed ? "shadow-xs" : "text-muted-foreground"
              }`}
            >
              <Bell className="h-4 w-4 mr-1.5" />
              Feed
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1.5 px-1.5 py-0 text-[10px] h-4 min-w-[16px] justify-center rounded-full"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </Link>

          <Link href="/me/calendar">
            <Button
              variant={isCalendar ? "default" : "ghost"}
              size="sm"
              className={`text-xs sm:text-sm font-medium rounded-md ${
                isCalendar ? "shadow-xs" : "text-muted-foreground"
              }`}
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              Training Calendar
            </Button>
          </Link>

          <Link href="/me/profile">
            <Button
              variant={isProfile ? "default" : "ghost"}
              size="sm"
              className={`text-xs sm:text-sm font-medium rounded-md ${
                isProfile ? "shadow-xs" : "text-muted-foreground"
              }`}
            >
              <User className="h-4 w-4 mr-1.5" />
              My Profile
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
