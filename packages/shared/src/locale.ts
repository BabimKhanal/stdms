import DateConverter from "@remotemerge/nepali-date-converter";

export type AppLocale = "en" | "ne";

export const APP_LOCALES = [
  { value: "en", label: "English", intl: "en-US" },
  { value: "ne", label: "नेपाली", intl: "ne-NP" },
] as const satisfies ReadonlyArray<{ value: AppLocale; label: string; intl: string }>;

export function intlLocale(locale: AppLocale = "en") {
  return locale === "ne" ? "ne-NP" : "en-US";
}

export function formatLocaleDate(
  value: string | Date | null | undefined,
  locale: AppLocale = "en",
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);

  if (locale === "ne") {
    const bsDate = formatBikramSambatDate(date, options, typeof value === "string" ? value : undefined);
    if (bsDate) return bsDate;
  }

  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date);
}

const BS_MONTHS = [
  ["बैशाख", "बैशाख"],
  ["जेठ", "जेठ"],
  ["असार", "असार"],
  ["साउन", "साउन"],
  ["भदौ", "भाद्र"],
  ["असोज", "आश्विन"],
  ["कात्तिक", "कार्तिक"],
  ["मंसिर", "मार्गशीर्ष"],
  ["पुस", "पौष"],
  ["माघ", "माघ"],
  ["फागुन", "फाल्गुण"],
  ["चैत", "चैत्र"],
] as const;

function formatBikramSambatDate(date: Date, options: Intl.DateTimeFormatOptions, source?: string) {
  const adDate = /^\d{4}-\d{2}-\d{2}/.test(source ?? "")
    ? source!.slice(0, 10)
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  try {
    const bs = new DateConverter(adDate).toBs();
    const number = new Intl.NumberFormat("ne-NP", { useGrouping: false });
    const day = options.day === "2-digit" ? String(bs.date).padStart(2, "0") : String(bs.date);
    const year = number.format(bs.year);
    const month = BS_MONTHS[bs.month - 1];
    const monthName =
      options.month === "long"
        ? month[1]
        : options.month === "numeric"
          ? number.format(bs.month)
          : month[0];
    const parts = [
      options.day === undefined ? undefined : number.format(Number(day)),
      options.month === undefined ? undefined : monthName,
      options.year === undefined ? undefined : year,
    ].filter(Boolean);
    const dateText = parts.join(" ");

    if (options.weekday) {
      const weekday = new Intl.DateTimeFormat("ne-NP", { weekday: options.weekday }).format(date);
      return `${weekday}, ${dateText}`;
    }

    return dateText;
  } catch {
    return null;
  }
}
