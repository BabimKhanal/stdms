"use client";

import { useEffect } from "react";
import { SESSION_EXPIRED_EVENT } from "@edu/api-client";

const AUTH_KEYS = ["edu_access_token", "edu_refresh_token", "edu_user"];

export function SessionExpiryGuard() {
  useEffect(() => {
    let redirecting = false;
    const handleExpiredSession = () => {
      if (redirecting) return;
      redirecting = true;
      AUTH_KEYS.forEach((key) => localStorage.removeItem(key));

      const publicAuthPage = ["/login", "/forgot-password", "/reset-password"].includes(window.location.pathname);
      if (!publicAuthPage) window.location.replace("/login?sessionExpired=1");
      else redirecting = false;
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  return null;
}