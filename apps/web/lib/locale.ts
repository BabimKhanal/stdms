import { formatLocaleDate, type AppLocale } from "@edu/shared";

const STORAGE_KEY = "edu_locale";

export function getAppLocale(): AppLocale {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(STORAGE_KEY) === "ne" ? "ne" : "en";
}

export function setAppLocale(locale: AppLocale) {
  localStorage.setItem(STORAGE_KEY, locale);
  window.location.reload();
}

export function formatAppDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  return formatLocaleDate(value, getAppLocale(), options);
}
