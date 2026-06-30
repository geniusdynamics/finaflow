// ABOUTME: Renders active popup banners as floating dismissible banners at the top of the page.
// ABOUTME: Tracks banner reads, link clicks, and dismissals.
import { useEffect, useState, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { X, Megaphone, AlertTriangle, CheckCircle } from "lucide-react";

function severityStyles(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-50 border-red-200 text-red-900";
    case "warning":
      return "bg-amber-50 border-amber-200 text-amber-900";
    case "info":
    default:
      return "bg-[#FFF9F5] border-[#E8E0D8] text-[#2D2A26]";
  }
}

function severityIcon(severity: string) {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case "info":
    default:
      return <Megaphone className="h-5 w-5 text-[#C73E1D]" />;
  }
}

export function BannerNotifications() {
  const { data: banners, isLoading } = trpc.notifications.getActiveBanners.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const utils = trpc.useUtils();
  const trackRead = trpc.notifications.trackRead.useMutation({ onSuccess: () => utils.notifications.invalidate() });
  const trackLinkClick = trpc.notifications.trackLinkClick.useMutation({ onSuccess: () => utils.notifications.invalidate() });
  const dismissBanner = trpc.notifications.dismissBanner.useMutation({ onSuccess: () => utils.notifications.invalidate() });

  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const [readIds, setReadIds] = useState<number[]>([]);

  const activeBanner = banners?.find((b) => !dismissedIds.includes(b.id));

  const handleDismiss = useCallback((id: number) => {
    setDismissedIds((prev) => [...prev, id]);
    dismissBanner.mutate({ id });
  }, [dismissBanner]);

  const handleLinkClick = useCallback((id: number, url: string) => {
    trackLinkClick.mutate({ id });
    setTimeout(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    }, 0);
  }, [trackLinkClick]);

  // Track read after the banner has been visible for 2 seconds.
  useEffect(() => {
    if (!activeBanner || readIds.includes(activeBanner.id)) return;
    const timer = setTimeout(() => {
      setReadIds((prev) => [...prev, activeBanner.id]);
      trackRead.mutate({ id: activeBanner.id });
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeBanner, readIds, trackRead]);

  if (isLoading || !activeBanner) return null;

  return (
    <div className={`relative z-40 border-b px-4 py-3 shadow-sm ${severityStyles(activeBanner.severity)}`}>
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <div className="mt-0.5 shrink-0">{severityIcon(activeBanner.severity)}</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{activeBanner.title}</h3>
          <p className="mt-0.5 text-sm opacity-90">{activeBanner.message}</p>
          {activeBanner.linkUrl && (
            <button
              type="button"
              onClick={() => {
                if (!activeBanner.linkUrl) return;
                handleLinkClick(activeBanner.id, activeBanner.linkUrl);
              }}
              className="mt-2 inline-flex items-center text-sm font-medium text-[#C73E1D] underline hover:text-[#C73E1D]/80"
            >
              {activeBanner.linkLabel || "Learn more"}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleDismiss(activeBanner.id)}
          aria-label="Dismiss banner"
          className="shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
