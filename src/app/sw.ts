import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, ExpirationPlugin } from "serwist";

// Deklarasikan nilai `injectionPoint`-nya di radar penangkapan TypeScript nih.
// `injectionPoint` is the string that points to where you want to inject the precache manifest.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// @ts-expect-error: TypeScript doesn't include ServiceWorkerGlobalScope by default without webworker lib
declare const self: ServiceWorkerGlobalScope;

// Custom caching sepesial aturan mainnya buatt si Alkitab
const alkitabCache = [
  {
    matcher: ({ url }: { url: URL }) => url.pathname.startsWith('/alkitab/') && url.pathname.endsWith('.json'),
    handler: new CacheFirst({
      cacheName: 'alkitab-data',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 1500,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year — Bible text doesn't change
        }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...alkitabCache, ...defaultCache],
});

serwist.addEventListeners();

// ====== WEB PUSH NOTIFICATION LISTENERS ======

self.addEventListener("push", (event: any) => {
  let data = { title: "Notifikasi GSJA", body: "Ada pembaruan", url: "/" };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error("Push data is not JSON", e);
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png", // Assuming PWA icons generated
    badge: "/icons/icon-192x192.png",
    data: data.url,
    vibrate: [200, 100, 200, 100, 200, 100, 200]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  const urlToOpen = event.notification.data || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients: any[]) => {
      // Nah, klo tyt window-nya uda ngebuka, arahin dan geser kesana lsg
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
