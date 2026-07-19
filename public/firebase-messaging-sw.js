/* global importScripts, firebase, self, clients */
// Firebase Cloud Messaging service worker — handles push messages while the
// app is closed or in the background. The FCM SDK registers this file
// automatically at its own scope, separate from the PWA service worker.
// These config values are public identifiers (they ship in the client bundle).
importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCAL8jSmjssZEKAvfRGM5CobDtDm-anT4E",
  authDomain: "uec-app-6c283.firebaseapp.com",
  projectId: "uec-app-6c283",
  storageBucket: "uec-app-6c283.firebasestorage.app",
  messagingSenderId: "392947220025",
  appId: "1:392947220025:web:917495cc927fa1462897e8",
});

const messaging = firebase.messaging();

// Data-only messages don't display automatically — show them here.
// (Messages with a `notification` payload are displayed by the SDK itself.)
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  if (payload.notification) return; // SDK already displayed it

  self.registration.showNotification(data.title || "UEC Church", {
    body: data.body || "",
    icon: "/icons/pwa-192x192.png",
    badge: "/icons/pwa-64x64.png",
    data: { url: data.url || "/" },
  });
});

// Focus or open the app when a notification is clicked
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
