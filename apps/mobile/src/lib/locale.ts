import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { formatLocaleDate, type AppLocale } from "@edu/shared";

const STORAGE_KEY = "edu_locale";
let currentLocale: AppLocale = "en";
let loaded = false;
const listeners = new Set<(locale: AppLocale) => void>();

function notify() {
  listeners.forEach((listener) => listener(currentLocale));
}

export function getAppLocale() {
  return currentLocale;
}

export async function loadAppLocale() {
  if (loaded) return currentLocale;
  const value = Platform.OS === "web"
    ? typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY)
    : await SecureStore.getItemAsync(STORAGE_KEY);
  currentLocale = value === "ne" ? "ne" : "en";
  loaded = true;
  notify();
  return currentLocale;
}

export async function setAppLocale(locale: AppLocale) {
  currentLocale = locale;
  loaded = true;
  if (Platform.OS === "web") localStorage.setItem(STORAGE_KEY, locale);
  else await SecureStore.setItemAsync(STORAGE_KEY, locale);
  notify();
}

export function useAppLocale() {
  const [locale, setLocale] = useState(currentLocale);
  useEffect(() => {
    const listener = (next: AppLocale) => setLocale(next);
    listeners.add(listener);
    void loadAppLocale();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return locale;
}

export function formatAppDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  return formatLocaleDate(value, currentLocale, options);
}
