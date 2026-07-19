// Client helper for triggering push notifications via /api/notify.
// Best-effort: failures are logged, never thrown, so a push problem can
// never break the save flow that triggered it. Note: /api/notify only runs
// on Vercel deployments — during `npm run dev` this quietly no-ops.
export const sendPushNotification = async ({ title, body = "", url = "/" }) => {
  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, url }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn("Push notification not sent:", error.message);
    return null;
  }
};
