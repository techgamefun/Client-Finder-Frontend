self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    const rawPayload = event.data.text();
    try {
      const decoded = JSON.parse(rawPayload);
      payload =
        decoded && typeof decoded === "object" && !Array.isArray(decoded)
          ? decoded
          : { body: rawPayload };
    } catch {
      payload = { body: rawPayload };
    }
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title
      : "ProspectLoop";
  const options = {
    body:
      typeof payload.body === "string" && payload.body.trim()
        ? payload.body
        : "There is an update in your workspace.",
    icon: "/brand-mark.png",
    badge: "/brand-mark.png",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: {
      url: typeof payload.url === "string" ? payload.url : "/organization",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url;
  let targetUrl = `${self.location.origin}/organization`;
  try {
    const target = new URL(
      typeof requestedUrl === "string" ? requestedUrl : "/organization",
      self.location.origin,
    );
    if (target.origin === self.location.origin) {
      targetUrl = target.href;
    }
  } catch {
    targetUrl = `${self.location.origin}/organization`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      async (clients) => {
        for (const client of clients) {
          if (new URL(client.url).origin === self.location.origin) {
            await client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      },
    ),
  );
});
