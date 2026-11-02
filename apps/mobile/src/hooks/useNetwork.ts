import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { API_URL } from "../config";

type NetworkState = { online: boolean; checking: boolean };

export function useNetwork(): NetworkState & { retry: () => void } {
  const [state, setState] = useState<NetworkState>({
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    checking: false,
  });

  const check = useCallback(async () => {
    setState((s) => ({ ...s, checking: true }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const liveUrl = `${API_URL.replace(/\/api\/v1$/, "")}/live`;
      const response = await fetch(liveUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      setState({ online: response.ok, checking: false });
    } catch {
      setState({ online: false, checking: false });
    } finally {
      clearTimeout(timeout);
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

  return { ...state, retry: () => void check() };
}
