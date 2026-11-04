"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { APP_LOCALES } from "@edu/shared";
import { getAppLocale, setAppLocale } from "../lib/locale";

export function LocaleSwitcher() {
  const [locale] = useState(getAppLocale);
  return (
    <label className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-600">
      <Languages size={16} />
      <span className="sr-only">Language</span>
      <select value={locale} onChange={(event) => setAppLocale(event.target.value as "en" | "ne")} className="bg-transparent text-sm outline-none">
        {APP_LOCALES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
  );
}
