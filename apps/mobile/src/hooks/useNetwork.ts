import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

type NetworkState = { online: boolean; checking: boolean };

export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    checking: false,
  });

  const check = useCallback(async () => {
    setState((s) => ({ ...s, checking: true }));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch("/", { method: "HEAD", cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      setState({ online: true, checking: false });
    } catch {
      setState({ online: false, checking: false });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      const onOnline = () => setState({ online: true, checking: false });
      const onOffline = () => setState({ online: false, checking: false });
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    }
    let timer: ReturnType<typeof setInterval>;
    const handle = setTimeout(check, 0);
    timer = setInterval(check, 30000);
    return () => {
      clearTimeout(handle);
      clearInterval(timer);
    };
  }, [check]);

  return state;
}
