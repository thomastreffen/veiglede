import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import type { AppNotification } from "@/components/NotificationBell";

const PERMISSION_DELAY_MS = 30_000;
const PROMPT_FLAG = "veiglede_notif_prompted";

export function useBrowserNotifications() {
  const { user } = useAuth();
  const promptedRef = useRef(false);

  // Prompt for permission once, 30s after login.
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (promptedRef.current) return;
    if (localStorage.getItem(PROMPT_FLAG)) return;

    const t = setTimeout(() => {
      promptedRef.current = true;
      localStorage.setItem(PROMPT_FLAG, "1");
      Notification.requestPermission().catch(() => {});
    }, PERMISSION_DELAY_MS);
    return () => clearTimeout(t);
  }, [user]);

  const notify = useCallback((n: AppNotification) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return; // skip if user is actively here
    try {
      const notif = new Notification(n.title, {
        body: n.body ?? undefined,
        icon: "/favicon.ico",
        tag: n.id,
      });
      notif.onclick = () => {
        window.focus();
        if (n.link) window.location.href = n.link;
        notif.close();
      };
    } catch {
      // ignore
    }
  }, []);

  return { notify };
}
