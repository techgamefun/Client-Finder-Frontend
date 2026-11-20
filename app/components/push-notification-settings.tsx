"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPushNotificationSettings,
  removePushSubscription,
  savePushSubscription,
  updatePushNotificationPreferences,
  type PushNotificationPreferences,
} from "@/lib/api";

const defaultPreferences: PushNotificationPreferences = {
  website_crawl_enabled: true,
  pagespeed_enabled: true,
  outreach_enabled: true,
};

const preferenceKeys: (keyof PushNotificationPreferences)[] = [
  "website_crawl_enabled",
  "pagespeed_enabled",
  "outreach_enabled",
];

type ServiceWorkerStatus = "checking" | "ready" | "error";

export function PushNotificationSettings() {
  const queryClient = useQueryClient();
  const isPushSupported = useSyncExternalStore(
    subscribeToPushSupport,
    getPushSupport,
    () => false,
  );
  const [serviceWorkerStatus, setServiceWorkerStatus] =
    useState<ServiceWorkerStatus>("checking");
  const [serviceWorkerError, setServiceWorkerError] = useState("");
  const [browserSubscription, setBrowserSubscription] =
    useState<PushSubscription | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [preferencesDraft, setPreferencesDraft] =
    useState<PushNotificationPreferences | null>(null);
  const settingsQuery = useQuery({
    queryKey: ["push-notification-settings"],
    queryFn: getPushNotificationSettings,
    retry: false,
  });
  const preferenceMutation = useMutation({
    mutationFn: updatePushNotificationPreferences,
    onSuccess: async (savedPreferences) => {
      setPreferencesDraft(savedPreferences);
      await queryClient.invalidateQueries({
        queryKey: ["push-notification-settings"],
      });
    },
  });

  useEffect(() => {
    let active = true;
    if (!isPushSupported) return;
    navigator.serviceWorker
      .register("/push-sw.js")
      .then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        if (!active) return;
        setBrowserSubscription(subscription);
        setPermission(Notification.permission);
        setServiceWorkerStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setServiceWorkerError(
          error instanceof Error
            ? error.message
            : "The service worker could not be registered.",
        );
        setServiceWorkerStatus("error");
      });

    return () => {
      active = false;
    };
  }, [isPushSupported]);

  const preferences =
    preferencesDraft ?? settingsQuery.data?.preferences ?? defaultPreferences;
  const frontendPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const serverKeyMatches =
    settingsQuery.data?.configured === true &&
    Boolean(frontendPublicKey) &&
    settingsQuery.data.public_key === frontendPublicKey;
  const currentSubscriptionSaved = useMemo(
    () =>
      Boolean(
        browserSubscription &&
          settingsQuery.data?.subscriptions.some(
            (subscription) =>
              subscription.endpoint === browserSubscription.endpoint,
          ),
      ),
    [browserSubscription, settingsQuery.data?.subscriptions],
  );
  const otherSubscriptionCount = Math.max(
    0,
    (settingsQuery.data?.subscriptions.length ?? 0) -
      (currentSubscriptionSaved ? 1 : 0),
  );
  const preferencesChanged = Boolean(
    settingsQuery.data &&
      preferenceKeys.some((preferenceKey) => {
        return (
          preferences[preferenceKey] !==
          settingsQuery.data?.preferences[preferenceKey]
        );
      }),
  );

  async function enablePushNotifications() {
    setActionError("");
    setActionPending(true);
    try {
      if (!serverKeyMatches || !settingsQuery.data?.public_key) {
        throw new Error(
          "Push notifications are not configured consistently on the frontend and backend.",
        );
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted") {
          throw new Error(
            result === "denied"
              ? "Notifications are blocked for this site. Allow them in your browser settings."
              : "Notification permission was not granted.",
          );
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(frontendPublicKey),
        });
      }

      await savePushSubscription(readSubscription(subscription));
      setBrowserSubscription(subscription);
      await settingsQuery.refetch();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not enable push notifications.",
      );
    } finally {
      setActionPending(false);
    }
  }

  async function disablePushNotifications() {
    if (!browserSubscription) return;
    setActionError("");
    setActionPending(true);
    try {
      await removePushSubscription(browserSubscription.endpoint);
      await browserSubscription.unsubscribe();
      setBrowserSubscription(null);
      await settingsQuery.refetch();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not disable push notifications.",
      );
    } finally {
      setActionPending(false);
    }
  }

  function togglePreference(key: keyof PushNotificationPreferences) {
    setPreferencesDraft((current) => {
      const currentPreferences =
        current ?? settingsQuery.data?.preferences ?? defaultPreferences;
      return { ...currentPreferences, [key]: !currentPreferences[key] };
    });
  }

  const canManageCurrentBrowser =
    isPushSupported &&
    serviceWorkerStatus === "ready" &&
    serverKeyMatches &&
    permission !== "denied" &&
    !actionPending;

  return (
    <div className="push-notification-settings">
      <section
        aria-labelledby="push-browser-settings-heading"
        className="panel settings-panel"
      >
        <div className="settings-section-heading">
          <div>
            <p className="eyebrow">PUSH NOTIFICATIONS</p>
            <h2 id="push-browser-settings-heading">Browser notifications</h2>
            <p className="panel-subtitle">
              Receive important updates from this workspace on this device.
            </p>
          </div>
          <span
            className={`push-notification-status${currentSubscriptionSaved ? " is-enabled" : ""}`}
          >
            {currentSubscriptionSaved ? "Enabled" : "Not enabled"}
          </span>
        </div>

        {settingsQuery.isPending && (
          <p className="settings-feedback" role="status">
            Loading notification settings…
          </p>
        )}
        {settingsQuery.isError && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            Could not load notification settings: {settingsQuery.error.message}
          </p>
        )}
        {settingsQuery.data && !settingsQuery.data.configured && (
          <p className="alert alert-error" role="alert">
            Push delivery is not configured on the server.
          </p>
        )}
        {settingsQuery.data?.configured &&
          frontendPublicKey &&
          !serverKeyMatches && (
            <p className="alert alert-error" role="alert">
              The frontend and backend VAPID public keys do not match.
            </p>
          )}
        {!frontendPublicKey && (
          <p className="alert alert-error" role="alert">
            Set NEXT_PUBLIC_VAPID_PUBLIC_KEY to enable browser subscriptions.
          </p>
        )}
        {!isPushSupported && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            This browser does not support Web Push notifications.
          </p>
        )}
        {serviceWorkerStatus === "error" && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            Could not prepare this browser for notifications: {serviceWorkerError}
          </p>
        )}
        {permission === "denied" && (
          <p className="settings-feedback settings-feedback-error" role="status">
            Notifications are blocked in this browser. Change the site
            permission in browser settings to enable them.
          </p>
        )}
        {actionError && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            {actionError}
          </p>
        )}

        <div className="push-notification-device-row">
          <div>
            <strong>This browser</strong>
            <p>
              {!isPushSupported
                ? "This browser does not support push notifications."
                : serviceWorkerStatus === "checking"
                  ? "Preparing this browser…"
                  : currentSubscriptionSaved
                    ? "Notifications are enabled on this device."
                    : browserSubscription
                      ? "A browser subscription needs to be linked or removed."
                      : "This device is not subscribed."}
            </p>
          </div>
          <button
            className={
              currentSubscriptionSaved
                ? "button button-secondary"
                : "button button-primary"
            }
            disabled={
              currentSubscriptionSaved || browserSubscription
                ? actionPending
                : !canManageCurrentBrowser
            }
            onClick={() =>
              currentSubscriptionSaved || browserSubscription
                ? void disablePushNotifications()
                : void enablePushNotifications()
            }
            type="button"
          >
            {actionPending
              ? "Updating…"
              : currentSubscriptionSaved
                ? "Disable on this browser"
                : browserSubscription
                  ? "Remove browser subscription"
                  : "Enable notifications"}
          </button>
        </div>
        {otherSubscriptionCount > 0 && (
          <p className="push-notification-other-devices">
            Notifications are also enabled on {otherSubscriptionCount} other{" "}
            {otherSubscriptionCount === 1 ? "device" : "devices"}.
          </p>
        )}
      </section>

      <section
        aria-labelledby="push-preferences-heading"
        className="panel settings-panel"
      >
        <div className="settings-section-heading">
          <div>
            <p className="eyebrow">PREFERENCES</p>
            <h2 id="push-preferences-heading">Notification types</h2>
            <p className="panel-subtitle">
              Choose which workspace updates may send push notifications.
            </p>
          </div>
        </div>
        <div className="push-notification-preferences">
          <PreferenceCheckbox
            checked={preferences.website_crawl_enabled}
            description="When a website indexing job succeeds or fails."
            label="Website indexing"
            onChange={() => togglePreference("website_crawl_enabled")}
          />
          <PreferenceCheckbox
            checked={preferences.pagespeed_enabled}
            description="When a PageSpeed scan completes or fails."
            label="PageSpeed scans"
            onChange={() => togglePreference("pagespeed_enabled")}
          />
          <PreferenceCheckbox
            checked={preferences.outreach_enabled}
            description="When outreach campaigns have important updates."
            label="Outreach"
            onChange={() => togglePreference("outreach_enabled")}
          />
        </div>
        {preferenceMutation.isError && (
          <p className="settings-feedback settings-feedback-error" role="alert">
            Could not save notification preferences:{" "}
            {preferenceMutation.error.message}
          </p>
        )}
        <div className="settings-actions">
          <button
            className="button button-primary"
            disabled={
              !preferencesChanged ||
              preferenceMutation.isPending ||
              settingsQuery.isPending
            }
            onClick={() => preferenceMutation.mutate(preferences)}
            type="button"
          >
            {preferenceMutation.isPending ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </section>
    </div>
  );
}

function subscribeToPushSupport() {
  return () => {};
}

function getPushSupport() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function PreferenceCheckbox({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="push-notification-preference">
      <input checked={checked} onChange={onChange} type="checkbox" />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

function decodeVapidPublicKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const decoded = window.atob(padded);
  const result = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    result[index] = decoded.charCodeAt(index);
  }
  return result;
}

function readSubscription(subscription: PushSubscription) {
  const p256dh = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");
  if (!p256dh || !auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64Url(p256dh),
      auth: arrayBufferToBase64Url(auth),
    },
  };
}

function arrayBufferToBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
