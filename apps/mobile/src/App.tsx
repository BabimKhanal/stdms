import { Assets as NavigationAssets } from "@react-navigation/elements";
import { DefaultTheme } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { createURL } from "expo-linking";
import * as ExpoLinking from "expo-linking";
import type { NotificationResponse } from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Navigation } from "./navigation";
import { AuthProvider, mobileToken, useAuth } from "./auth";
import { Login } from "./screens/Login";
import { ForcedPasswordChange } from "./screens/ForcedPasswordChange";
import { useNetwork } from "./hooks/useNetwork";
import { OfflineBanner } from "./components/OfflineBanner";
import { syncPushNotifications } from "./lib/push-notifications";

Asset.loadAsync([
  ...NavigationAssets,
  require("./assets/newspaper.png"),
  require("./assets/bell.png"),
]);

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

if (Platform.OS !== "web") {
  void import("expo-notifications").then((notifications) => {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  });
}

function pushResponseUrl(response: NotificationResponse | null) {
  const data = response?.notification.request.content.data;
  if (typeof data?.url === "string") return data.url;
  return data?.screen === "updates" ? createURL("updates") : null;
}

const linking = {
  enabled: "auto" as const,
  prefixes: [createURL("/"), "nucleus-education://"],
  async getInitialURL() {
    const url = await ExpoLinking.getInitialURL();
    if (url) return url;
    if (Platform.OS === "web") return null;
    const notifications = await import("expo-notifications");
    const response = await notifications
      .getLastNotificationResponseAsync()
      .catch(() => null);
    return pushResponseUrl(response);
  },
  subscribe(listener: (url: string) => void) {
    const linkSubscription = ExpoLinking.addEventListener("url", ({ url }) =>
      listener(url),
    );
    let active = true;
    let notificationSubscription: { remove: () => void } | undefined;
    if (Platform.OS !== "web") {
      void import("expo-notifications").then((notifications) => {
        if (!active) return;
        notificationSubscription =
          notifications.addNotificationResponseReceivedListener((response) => {
            const url = pushResponseUrl(response);
            if (url) listener(url);
          });
      });
    }
    return () => {
      active = false;
      linkSubscription.remove();
      notificationSubscription?.remove();
    };
  },
};

export function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const { online, checking, retry } = useNetwork();

  useEffect(() => {
    if (!userId || Platform.OS === "web") return;
    let active = true;
    void mobileToken().then((token) => {
      if (active && token)
        void syncPushNotifications(token).catch(() => undefined);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (loading)
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#f8fafc",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator color="#2563eb" size="large" />
      </View>
    );
  if (!user) return <Login />;
  if (user.mustChangePassword) return <ForcedPasswordChange />;

  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: "#f8fafc",
      card: "#ffffff",
      border: "#ddd6fe",
      text: "#1e1b4b",
      primary: "#7c3aed",
    },
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      {!online && Platform.OS !== "web" && (
        <OfflineBanner online={false} checking={checking} onRetry={retry} />
      )}
      <Navigation
        theme={theme}
        linking={linking}
        onReady={() => {
          void SplashScreen.hideAsync().catch(() => undefined);
        }}
      />
    </>
  );
}
