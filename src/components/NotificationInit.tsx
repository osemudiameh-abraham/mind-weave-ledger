/**
 * NotificationInit — initializes the notification system.
 * Shows a one-time toast with an "Enable" button to request notification permission.
 * The button tap is a direct user gesture — required by mobile browsers (iOS/Android).
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/use-notifications";

const NotificationInit = () => {
  const { permission, requestPermission } = useNotifications();
  const promptedRef = useRef(false);

  useEffect(() => {
    // Only prompt once per session, only if permission hasn't been decided
    if (promptedRef.current) return;
    if (permission !== "default") return;
    if (typeof Notification === "undefined") return;

    promptedRef.current = true;

    // Show toast after a short delay so it doesn't feel jarring
    const timer = setTimeout(() => {
      toast("Stay in the loop", {
        description: "Get notified about decision reviews and pattern warnings.",
        duration: 10000,
        action: {
          label: "Enable",
          onClick: () => {
            requestPermission();
          },
        },
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [permission, requestPermission]);

  return null;
};

export default NotificationInit;
