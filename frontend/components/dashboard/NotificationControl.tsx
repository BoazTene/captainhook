"use client";

import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import NotificationsOffRoundedIcon from "@mui/icons-material/NotificationsOffRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useMemo, useState, useEffect } from "react";

interface WebPushPublicKeyResponse {
  public_key: string | null;
}

interface PushSubscriptionCreateResponse {
  id: number;
  endpoint: string;
}

interface PushSubscriptionRead {
  id: number;
  endpoint: string;
}

interface NotificationSettings {
  morning_reminder_hour: number;
  follow_up_start_hour: number;
  follow_up_end_hour: number;
  follow_up_interval_hours: number;
}

type PushStatus = "loading" | "unsupported" | "enabled" | "disabled" | "blocked";
type SupportCheck = {
  supported: boolean;
  reason: string | null;
};

const CLIENT_ID_STORAGE_KEY = "captainhook-push-client-id";
const SUBSCRIPTION_ID_STORAGE_KEY = "captainhook-push-subscription-id";
const SERVICE_WORKER_PATH = "/sw.js";

function getOrCreateClientId(): string {
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const next = window.crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, next);
  return next;
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output.buffer;
}

function getPushSupport(): SupportCheck {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Push detection is only available in the browser." };
  }

  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: "Push requires HTTPS on Android. Open this site over HTTPS, or use localhost during local development.",
    };
  }

  if (!("Notification" in window)) {
    return { supported: false, reason: "This browser does not expose the Notifications API." };
  }

  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "This browser does not support service workers." };
  }

  if (!("PushManager" in window)) {
    return {
      supported: false,
      reason: "This browser does not support the Push API. On Android, test in a current Chrome or Edge browser.",
    };
  }

  return { supported: true, reason: null };
}

export function NotificationControl() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<NotificationSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState<boolean>(false);

  const support = useMemo(() => getPushSupport(), []);
  const isSupported = support.supported;

  const resolveBackendSubscriptionId = async (clientId: string, endpoint: string): Promise<number | null> => {
    const response = await fetch(`/api/notifications/subscriptions?client_id=${encodeURIComponent(clientId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    const subscriptions = (await response.json()) as PushSubscriptionRead[];
    const match = subscriptions.find((item) => item.endpoint === endpoint);
    return match?.id ?? null;
  };

  const loadInitialState = useCallback(async () => {
    if (!isSupported) {
      setUnsupportedReason(support.reason);
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("blocked");
      return;
    }

    const keyResponse = await fetch("/api/notifications/public-key", { cache: "no-store" });
    if (!keyResponse.ok) {
      setStatus("disabled");
      setError("Failed to load push public key.");
      return;
    }

    const keyPayload = (await keyResponse.json()) as WebPushPublicKeyResponse;
    setPublicKey(keyPayload.public_key);

    const settingsResponse = await fetch("/api/notifications/settings", { cache: "no-store" });
    if (!settingsResponse.ok) {
      throw new Error("Failed to load notification settings.");
    }

    const settingsPayload = (await settingsResponse.json()) as NotificationSettings;
    setSettings(settingsPayload);
    setSettingsDraft(settingsPayload);

    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
    const subscription = await registration.pushManager.getSubscription();
    setStatus(subscription ? "enabled" : "disabled");
  }, [isSupported, support.reason]);

  const updateSettingsField = (
    field: keyof NotificationSettings,
    value: number,
  ) => {
    setSettingsDraft((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, [field]: value };
    });
  };

  const saveSettings = async () => {
    if (!settingsDraft) {
      return;
    }

    setSettingsError(null);
    setIsSavingSettings(true);

    try {
      const response = await fetch("/api/notifications/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settingsDraft),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const detail =
          payload && typeof payload.detail === "string" ? payload.detail : `Failed to save settings: ${response.status}`;
        throw new Error(detail);
      }

      const payload = (await response.json()) as NotificationSettings;
      setSettings(payload);
      setSettingsDraft(payload);
      setIsSettingsDialogOpen(false);
    } catch (settingsSaveError) {
      setSettingsError(settingsSaveError instanceof Error ? settingsSaveError.message : "Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openSettingsDialog = () => {
    setSettingsError(null);
    setSettingsDraft(settings);
    setIsSettingsDialogOpen(true);
  };

  const closeSettingsDialog = () => {
    setSettingsError(null);
    setSettingsDraft(settings);
    setIsSettingsDialogOpen(false);
  };

  const subscribe = async () => {
    if (!publicKey) {
      setError("Push key is not configured on backend.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "disabled");
        return;
      }

      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
      const applicationServerKey = urlBase64ToArrayBuffer(publicKey);
      const existing = await registration.pushManager.getSubscription();
      const browserSubscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));

      const json = browserSubscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error("Invalid browser subscription payload.");
      }

      const clientId = getOrCreateClientId();
      const response = await fetch("/api/notifications/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
          user_agent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to register push subscription: ${response.status}`);
      }

      const payload = (await response.json()) as PushSubscriptionCreateResponse;
      window.localStorage.setItem(SUBSCRIPTION_ID_STORAGE_KEY, String(payload.id));
      setStatus("enabled");
    } catch (subscribeError) {
      setError(subscribeError instanceof Error ? subscribeError.message : "Failed to enable notifications.");
      setStatus("disabled");
    } finally {
      setIsSubmitting(false);
    }
  };

  const unsubscribe = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
      const browserSubscription = await registration.pushManager.getSubscription();
      const endpoint = browserSubscription?.endpoint ?? null;
      if (browserSubscription) {
        await browserSubscription.unsubscribe();
      }

      const clientId = getOrCreateClientId();
      const fromStorage = window.localStorage.getItem(SUBSCRIPTION_ID_STORAGE_KEY);
      const subscriptionId =
        fromStorage !== null
          ? Number(fromStorage)
          : endpoint
            ? await resolveBackendSubscriptionId(clientId, endpoint)
            : null;

      if (subscriptionId && Number.isFinite(subscriptionId)) {
        await fetch(`/api/notifications/subscriptions/${subscriptionId}`, { method: "DELETE" });
      }

      window.localStorage.removeItem(SUBSCRIPTION_ID_STORAGE_KEY);
      setStatus("disabled");
    } catch (unsubscribeError) {
      setError(unsubscribeError instanceof Error ? unsubscribeError.message : "Failed to disable notifications.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    void loadInitialState().catch((initialError) => {
      setStatus("disabled");
      setError(initialError instanceof Error ? initialError.message : "Failed to initialize notifications.");
    });
  }, [loadInitialState]);

  const disabled = status === "loading" || status === "unsupported" || isSubmitting;
  const hasSettingsChanges = JSON.stringify(settingsDraft) !== JSON.stringify(settings);

  return (
    <Stack spacing={0.75} alignItems={{ xs: "stretch", sm: "flex-end" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} width="100%" justifyContent="flex-end">
        <Button
          variant="text"
          color="inherit"
          startIcon={<SettingsRoundedIcon />}
          onClick={openSettingsDialog}
          disabled={settingsDraft === null}
        >
          Reminder Schedule
        </Button>
        <Button
          variant={status === "enabled" ? "contained" : "outlined"}
          color={status === "enabled" ? "success" : "primary"}
          onClick={status === "enabled" ? () => void unsubscribe() : () => void subscribe()}
          disabled={disabled || status === "blocked"}
          startIcon={status === "enabled" ? <NotificationsActiveRoundedIcon /> : <NotificationsOffRoundedIcon />}
        >
          {status === "loading"
            ? "Checking push..."
          : status === "enabled"
              ? "Disable Notifications"
              : "Enable Notifications"}
        </Button>
      </Stack>

      {status === "unsupported" && (
        <Typography variant="caption" color="text.secondary">
          {unsupportedReason ?? "Push notifications are not supported in this browser."}
        </Typography>
      )}
      {status === "blocked" && (
        <Typography variant="caption" color="warning.main">
          Notifications are blocked in browser settings.
        </Typography>
      )}
      {error && (
        <Typography variant="caption" color="error.main">
          {error}
        </Typography>
      )}

      <Dialog open={isSettingsDialogOpen} onClose={isSavingSettings ? undefined : closeSettingsDialog} fullWidth maxWidth="xs">
        <DialogTitle>Reminder Schedule</DialogTitle>
        <DialogContent dividers>
          {settingsDraft && (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <TextField
                label="Morning reminder hour"
                type="number"
                size="small"
                inputProps={{ min: 0, max: 23 }}
                value={settingsDraft.morning_reminder_hour}
                onChange={(event) => updateSettingsField("morning_reminder_hour", Number(event.target.value))}
              />
              <TextField
                label="Follow-up start hour"
                type="number"
                size="small"
                inputProps={{ min: 0, max: 23 }}
                value={settingsDraft.follow_up_start_hour}
                onChange={(event) => updateSettingsField("follow_up_start_hour", Number(event.target.value))}
              />
              <TextField
                label="Follow-up end hour"
                type="number"
                size="small"
                inputProps={{ min: 0, max: 23 }}
                value={settingsDraft.follow_up_end_hour}
                onChange={(event) => updateSettingsField("follow_up_end_hour", Number(event.target.value))}
              />
              <TextField
                label="Follow-up interval hours"
                type="number"
                size="small"
                inputProps={{ min: 1, max: 24 }}
                value={settingsDraft.follow_up_interval_hours}
                onChange={(event) => updateSettingsField("follow_up_interval_hours", Number(event.target.value))}
              />
              <Typography variant="caption" color="text.secondary">
                Hours use the server timezone. Default behavior is 9 for the first reminder and hourly follow-ups from 15 to 22.
              </Typography>
              {settingsError && (
                <Typography variant="caption" color="error.main">
                  {settingsError}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSettingsDialog} disabled={isSavingSettings}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void saveSettings()} disabled={isSavingSettings || !hasSettingsChanges}>
            {isSavingSettings ? "Saving..." : "Save Schedule"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
