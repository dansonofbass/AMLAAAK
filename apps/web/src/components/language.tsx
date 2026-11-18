"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { title } from "@/lib/utils";
export type Language = "en" | "fa";
const event = "amlaaak-language-change";
let memory: Language = "en";
function snapshot(): Language {
  try {
    return localStorage.getItem("amlaaak-language") === "fa" ? "fa" : "en";
  } catch {
    return memory;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(event, callback);
    window.removeEventListener("storage", callback);
  };
}
const names: Record<string, string> = {
  tehran: "تهران",
  karaj: "کرج",
  shiraz: "شیراز",
  mashhad: "مشهد",
  isfahan: "اصفهان",
  esfahan: "اصفهان",
  tabriz: "تبریز",
  ahvaz: "اهواز",
  rasht: "رشت",
  qom: "قم",
  yazd: "یزد",
  kermanshah: "کرمانشاه",
  "bandar-abbas": "بندرعباس",
  arak: "اراک",
  qazvin: "قزوین",
  hamedan: "همدان",
  urmia: "ارومیه",
  sari: "ساری",
  babol: "بابل",
  gorgan: "گرگان",
  sanandaj: "سنندج",
  bushehr: "بوشهر",
  zanjan: "زنجان",
  ardabil: "اردبیل",
  kerman: "کرمان",
  zahedan: "زاهدان",
  semnan: "سمنان",
  ilam: "ایلام",
  birjand: "بیرجند",
  bojnurd: "بجنورد",
  khorramabad: "خرم‌آباد",
  gholhak: "قلهک",
  north: "شمال",
  central: "مرکزی",
};
export function formatNumber(
  value: number | null | undefined,
  language: Language,
  compact = false,
  digits = 1,
) {
  if (value == null || !Number.isFinite(value)) return "—";
  return Intl.NumberFormat(language === "fa" ? "fa-IR" : "en", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : digits,
  }).format(value);
}
export function parseNumber(value: string) {
  const normalized = value
    .trim()
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/٬/g, ",")
    .replace("٫", ".");
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized))
    return NaN;
  return Number(normalized.replaceAll(",", ""));
}
function tools(language: Language) {
  const t = (en: string, fa: string) => (language === "fa" ? fa : en);
  return {
    language,
    rtl: language === "fa",
    t,
    n: (v: number | null | undefined, compact = false, digits = 1) =>
      formatNumber(v, language, compact, digits),
    year: (v: number | null | undefined) =>
      v == null
        ? "—"
        : Intl.NumberFormat(language === "fa" ? "fa-IR" : "en", {
            useGrouping: false,
            maximumFractionDigits: 1,
          }).format(v),
    city: (slug: string) =>
      language === "fa" ? names[slug] || title(slug) : title(slug),
    property: (kind: string) =>
      kind === "apartment-sell"
        ? t("Apartment", "آپارتمان")
        : t("House / Villa", "خانه / ویلا"),
    known: (value: boolean | null | undefined) =>
      value == null
        ? t("Unknown", "نامشخص")
        : value
          ? t("Yes", "بله")
          : t("No", "خیر"),
  };
}
const Context = createContext({
  ...tools("en"),
  setLanguage: (_language: Language) => {
    void _language;
  },
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "en" as Language,
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  }, [language]);
  function setLanguage(value: Language) {
    memory = value;
    try {
      localStorage.setItem("amlaaak-language", value);
    } catch {
      /* Session-only fallback. */
    }
    window.dispatchEvent(new Event(event));
  }
  return (
    <Context.Provider value={{ ...tools(language), setLanguage }}>
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
