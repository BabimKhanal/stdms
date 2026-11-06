import DateConverter from "@remotemerge/nepali-date-converter";
import type { AppLocale } from "./locale";

export const BS_MONTHS_EN = [
  "Baishakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

export const BS_MONTHS_NE = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कात्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फागुन",
  "चैत",
] as const;

export const BS_WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const BS_WEEKDAYS_NE = ["आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"] as const;

export type BsDate = {
  year: number;
  month: number;
  date: number;
  day: string;
};

export type BsGridCell = {
  bsDate: BsDate;
  adDate: string;
} | null;

const pad = (value: number) => String(value).padStart(2, "0");

export function adToBs(adDate: string): BsDate | null {
  try {
    const result = new DateConverter(adDate.slice(0, 10)).toBs();
    return { year: result.year, month: result.month, date: result.date, day: result.day };
  } catch {
    return null;
  }
}

export function bsToAd(year: number, month: number, date: number): string | null {
  try {
    const result = new DateConverter(`${year}-${pad(month)}-${pad(date)}`).toAd();
    return `${result.year}-${pad(result.month)}-${pad(result.date)}`;
  } catch {
    return null;
  }
}

function dayNumber(adDate: string) {
  const [year, month, date] = adDate.split("-").map(Number);
  return Date.UTC(year, month - 1, date) / 86400000;
}

export function bsMonthLength(year: number, month: number) {
  const start = bsToAd(year, month, 1);
  if (!start) return 30;
  const next = month === 12 ? bsToAd(year + 1, 1, 1) : bsToAd(year, month + 1, 1);
  if (!next) return 30;
  return Math.round(dayNumber(next) - dayNumber(start));
}

export function bsMonthAdRange(year: number, month: number) {
  const start = bsToAd(year, month, 1);
  const length = bsMonthLength(year, month);
  const end = start ? bsToAd(year, month, length) : null;
  return start && end ? { start, end } : null;
}

export function addBsMonths(year: number, month: number, amount: number) {
  const index = year * 12 + (month - 1) + amount;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function todayBs(now = new Date()) {
  return adToBs(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
}

/** A Sunday-first grid for a Bikram Sambat month, with nulls for padding days. */
export function bsMonthGrid(year: number, month: number): BsGridCell[][] {
  const firstAd = bsToAd(year, month, 1);
  if (!firstAd) return [];
  const length = bsMonthLength(year, month);
  const leading = new Date(`${firstAd}T12:00:00`).getDay();
  const cells: BsGridCell[] = Array.from({ length: leading }, () => null);

  for (let date = 1; date <= length; date += 1) {
    const adDate = bsToAd(year, month, date);
    if (!adDate) break;
    cells.push({
      bsDate: { year, month, date, day: new Date(`${adDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" }) },
      adDate,
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: BsGridCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

export function formatBsDate(adDate: string | null | undefined, locale: AppLocale = "en") {
  if (!adDate) return "-";
  const bs = adToBs(adDate);
  if (!bs) return adDate;
  const number = new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-US", { useGrouping: false });
  return `${number.format(bs.year)} ${locale === "ne" ? BS_MONTHS_NE[bs.month - 1] : BS_MONTHS_EN[bs.month - 1]} ${number.format(bs.date)}`;
}

export function formatBsMonth(year: number, month: number, locale: AppLocale = "en") {
  const number = new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-US", { useGrouping: false });
  return `${locale === "ne" ? BS_MONTHS_NE[month - 1] : BS_MONTHS_EN[month - 1]} ${number.format(year)}`;
}
