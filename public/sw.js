/**
 * Service Worker — Push Notifications
 * Architecture v5.5, Section 10.7
 *
 * Handles push events and notification clicks.
 * Works with VAPID web push when configured.
 */

self.addEventListener("push", (event) => {
  let data = { title: "Seven Mynd", body: "You have a notification", url: "/home" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {}

  const options = {
    body: data.body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: data.url || "/home" },
    tag: data.tag || "seven-mynd-" + Date.now(),
    renotify: false,
    silent: data.silent || false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/home";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
