"use client";
import { Database, Info } from "lucide-react";
import type { Provenance } from "@/lib/contracts";
import { useLanguage } from "./language";
export function CoverageNotice({ provenance }: { provenance: Provenance }) {
  const { t, n } = useLanguage();
  const c = provenance.coverage;
  const prepared = provenance.provider === "prepared";
  const sample = provenance.kind === "illustrative";
  if (prepared && !c?.exhaustive)
    return (
      <div className="coverage-notice" role="status">
        <Info size={14} />
        {t(
          "Historical archive unavailable. No substitute records were generated.",
          "آرشیو تاریخی در دسترس نیست. هیچ داده‌ای جایگزین نشده است.",
        )}
      </div>
    );
  return (
    <details className="coverage-notice">
      <summary>
        <Database size={14} />
        <strong>
          {sample
            ? t("Illustrative sample", "نمونه نمایشی")
            : prepared
              ? t(
                  "Prepared historical Divar archive",
                  "آرشیو آماده‌شده تاریخی دیوار",
                )
              : t(
                  "Historical Divar records · bounded retrieval",
                  "آگهی‌های تاریخی دیوار · دریافت محدود",
                )}
        </strong>
        <span>
          · {n(provenance.eligible_rows)}{" "}
          {t("available historical sales", "آگهی فروش")} ·{" "}
          {t("About this data", "درباره این داده‌ها")}
          <Info size={12} style={{ display: "inline", marginInlineStart: 5 }} />
        </span>
      </summary>
      <div className="coverage-details">
        <p>
          {sample
            ? t(
                "These are illustrative smoke-test records, not verified Divar observations.",
                "این داده‌ها نمونه نمایشی برای آزمون هستند، نه آگهی‌های تأییدشده دیوار.",
              )
            : prepared
              ? t(
                  "Complete query within the configured historical archive; not today’s housing market.",
                  "جستجوی کامل در آرشیو تاریخی تنظیم‌شده؛ نه بازار امروز مسکن.",
                )
              : t(
                  "Statistics describe only the retrieved source window, not the entire market.",
                  "آمار فقط مربوط به بخش دریافت‌شده از منبع است، نه کل بازار.",
                )}
        </p>
        <p>
          {n(provenance.input_rows)}{" "}
          {t("source rows processed", "ردیف منبع پردازش شده")} ·{" "}
          {n(c?.eligible_records ?? provenance.eligible_rows)}{" "}
          {t("matching this selection", "مطابق انتخاب فعلی")} ·{" "}
          {prepared && c?.source_processing_complete
            ? t(
                "Pinned source inventory verified complete.",
                "فهرست منبع نسخه ثابت کامل تأیید شده است.",
              )
            : ""}
        </p>
        <p>
          {t(
            "Asking prices, not verified transaction prices. Currency units are not independently verified.",
            "قیمت پیشنهادی است، نه قیمت معامله قطعی. واحد پول به‌طور مستقل تأیید نشده است.",
          )}
        </p>
        <p>
          {t(
            "The larger searchable archive was not used to retrain the approved model.",
            "آرشیو بزرگ‌تر جستجو برای آموزش مجدد مدل تأییدشده استفاده نشده است.",
          )}
        </p>
        <code dir="ltr">
          {t("Dataset revision", "نسخه داده")}: {provenance.revision}
        </code>
        <small>
          {provenance.period_start || "—"} — {provenance.period_end || "—"}
        </small>
      </div>
    </details>
  );
}
