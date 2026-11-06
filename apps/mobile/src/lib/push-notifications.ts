import * as Device from "expo-device";
import Constants from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "../config";

const TOKEN_KEY = "edu_expo_push_token";
const ENABLED_KEY = "edu_push_enabled";

export type PushPreference = {
  supported: boolean;
  enabled: boolean;
  permission: "granted" | "denied" | "not-determined" | "unavailable";
};

function hasPermission(
  permission: ExpoNotifications.NotificationPermissionsStatus,
  notifications: typeof import("expo-notifications"),
) {
  return (
    permission.granted ||
    permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function registerToken(accessToken: string) {
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId)
    throw new Error("Push notification project is not configured.");

  const Notifications = await import("expo-notifications");
  const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId }))
    .data;
  const response = await fetch(`${API_URL}/notifications/push-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
  });
  if (!response.ok)
    throw new Error("Could not register this device for notifications.");
  await SecureStore.setItemAsync(TOKEN_KEY, expoToken);
  await SecureStore.setItemAsync(ENABLED_KEY, "true");
}

export async function readPushPreference(): Promise<PushPreference> {
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    return { supported: false, enabled: false, permission: "unavailable" };
  try {
    const Notifications = await import("expo-notifications");
    const [enabled, permission] = await Promise.all([
      SecureStore.getItemAsync(ENABLED_KEY),
      Notifications.getPermissionsAsync(),
    ]);
    return {
      supported: true,
      enabled: enabled === "true" && hasPermission(permission, Notifications),
      permission: hasPermission(permission, Notifications)
        ? "granted"
        : permission.canAskAgain
          ? "not-determined"
          : "denied",
    };
  } catch {
    return { supported: true, enabled: false, permission: "unavailable" };
  }
}

export async function enablePushNotifications(accessToken: string) {
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    throw new Error(
      "Push notifications are available in the iOS and Android apps.",
    );
  if (!Device.isDevice)
    throw new Error(
      "Push notifications require a physical device and a development or production build.",
    );
  const Notifications = await import("expo-notifications");

  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("updates", {
      name: "School updates",
      description: "Notices, attendance, results, and account updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#7c3aed",
    });

  let permission = await Notifications.getPermissionsAsync();
  if (!hasPermission(permission, Notifications)) {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  if (!hasPermission(permission, Notifications))
    throw new Error(
      "Notification permission is off. Enable it in your device settings to receive school updates.",
    );

  await registerToken(accessToken);
}

export async function syncPushNotifications(accessToken: string) {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  if ((await SecureStore.getItemAsync(ENABLED_KEY)) !== "true") return;
  const Notifications = await import("expo-notifications");
  const permission = await Notifications.getPermissionsAsync();
  if (!hasPermission(permission, Notifications)) {
    await SecureStore.setItemAsync(ENABLED_KEY, "false");
    return;
  }
  await registerToken(accessToken);
}

export async function disablePushNotifications(accessToken: string) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    const response = await fetch(`${API_URL}/notifications/push-tokens`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    if (!response.ok)
      throw new Error(
        "Could not unregister this device. Try again when online.",
      );
  }
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.setItemAsync(ENABLED_KEY, "false"),
  ]);
}

export async function unregisterPushToken(accessToken: string | null) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token && accessToken) {
    await fetch(`${API_URL}/notifications/push-tokens`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    }).catch(() => undefined);
  }
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.setItemAsync(ENABLED_KEY, "false"),
  ]).catch(() => undefined);
}
