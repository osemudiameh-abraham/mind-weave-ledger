/**
 * NotificationInit — initializes the notification system.
 * Placed inside AuthProvider so it has access to the user session.
 * Registers service worker, polls for due reviews, shows notifications.
 */

import { useNotifications } from "@/hooks/use-notifications";

const NotificationInit = () => {
  useNotifications();
  return null;
};

export default NotificationInit;
