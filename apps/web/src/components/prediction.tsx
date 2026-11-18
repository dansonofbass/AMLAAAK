"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Calculator,
  ArrowRight,
  LoaderCircle,
  Info,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  modelSchema,
  predictionInputSchema,
  valuationSchema,
  type PredictionInput,
} from "@/lib/contracts";
import { useFacets } from "./workspace";
import { useLanguage, parseNumber } from "./language";
import { Picker } from "./ui/picker";
import { Button } from "./ui/button";
import { CoverageNotice } from "./coverage";
import { ComparableResults, type ValuationResult } from "./comparables";
type Fields = {
  city_slug: string;
  neighborhood_slug: string;
  cat3_slug: string;
  building_size: string;
  rooms_count: string;
  construction_year: string;
  floor: string;
  total_floors_count: string;
  has_parking: string;
  has_elevator: string;
  has_balcony: string;
  has_warehouse: string;
};
const initial: Fields = {
  city_slug: "",
  neighborhood_slug: "",
  cat3_slug: "apartment-sell",
  building_size: "",
  rooms_count: "",
  construction_year: "",
  floor: "",
  total_floors_count: "",
  has_parking: "",
  has_elevator: "",
  has_balcony: "",
  has_warehouse: "",
};
export function PredictionPage() {
  const { t, n, city } = useLanguage();
  const [fields, setFields] = useState<Fields>(initial),
    [asking, setAsking] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const all = useFacets(),
    local = useFacets(fields.city_slug || undefined);
  const status = useQuery({
    queryKey: ["model-status"],
    queryFn: () => api("model/status", modelSchema),
  });
  const mutation = useMutation({
    mutationFn: (body: PredictionInput) =>
      api("valuation", valuationSchema, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
  function update(key: keyof Fields, value: string) {
    setFields((old) => ({
      ...old,
      [key]: value,
      ...(key === "city_slug" ? { neighborhood_slug: "" } : {}),
    }));
    setErrors({});
    mutation.reset();
  }
  const optional = (value: string) =>
    value.trim() === "" ? null : parseNumber(value);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = predictionInputSchema.safeParse({
      city_slug: fields.city_slug,
      neighborhood_slug: fields.neighborhood_slug || null,
      cat3_slug: fields.cat3_slug,
      building_size: fields.building_size.trim()
        ? parseNumber(fields.building_size)
        : NaN,
      rooms_count:
        fields.rooms_count !== "" ? parseNumber(fields.rooms_count) : NaN,
      floor: optional(fields.floor),
      total_floors_count: optional(fields.total_floors_count),
      construction_year: optional(fields.construction_year),
      has_parking:
        fields.has_parking === "" ? null : fields.has_parking === "yes",
      has_elevator:
        fields.has_elevator === "" ? null : fields.has_elevator === "yes",
      has_balcony:
        fields.has_balcony === "" ? null : fields.has_balcony === "yes",
      has_warehouse:
        fields.has_warehouse === "" ? null : fields.has_warehouse === "yes",
    });
    const next: Record<string, string> = {};
    if (!result.success)
      for (const issue of result.error.issues)
        next[String(issue.path[0])] = t(
          "Check this value and the supported range.",
          "این مقدار و بازه مجاز را بررسی کنید.",
        );
    if (
      asking.trim() &&
      (!Number.isFinite(parseNumber(asking)) || parseNumber(asking) <= 0)
    )
      next.asking = t(
        "Enter a positive asking price.",
        "قیمت پیشنهادی باید عددی مثبت باشد.",
      );
    setErrors(next);
    if (result.success && !Object.keys(next).length)
      mutation.mutate(result.data);
  }
  const error = (key: string) =>
    errors[key] ? <small className="field-error">{errors[key]}</small> : null;
  const options = [
    { value: "", label: t("Unknown", "نامشخص") },
    { value: "yes", label: t("Yes", "بله") },
    { value: "no", label: t("No", "خیر") },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t(
              "A HISTORICAL PERSPECTIVE ON YOUR PROPERTY",
              "نگاهی تاریخی به ملک شما",
            )}
          </span>
          <h1>{t("Price Estimator", "برآورد قیمت ملک")}</h1>
          <p>
            {t(
              "Start with a few details. Compare a research estimate with actual historical asking prices.",
              "با چند مشخصه شروع کنید. برآورد پژوهشی مدل را با قیمت‌های پیشنهادی واقعی گذشته مقایسه کنید.",
            )}
          </p>
        </div>
        <span className="badge">
          <Info size={13} />
          {status.data?.mode === "illustrative"
            ? t("Illustrative test model", "مدل نمایشی آزمون")
            : t("Research estimate", "برآورد پژوهشی")}
        </span>
      </div>
      <div className="estimator-layout">
        <form
          className="form-panel"
          onSubmit={submit}
          noValidate
          aria-busy={mutation.isPending}
        >
          <fieldset
            disabled={mutation.isPending}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <div className="form-intro">
              <span className="step-number">01</span>
              <div>
                <h2>{t("Essential property details", "مشخصات اصلی ملک")}</h2>
                <p>
                  {t(
                    "Required fields are marked *.",
                    "فیلدهای ضروری با * مشخص شده‌اند.",
                  )}
                </p>
              </div>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>{t("City", "شهر")} *</span>
                <Picker
                  searchable
                  name="city_slug"
                  label={t("Property city", "شهر ملک")}
                  value={fields.city_slug}
                  disabled={all.isPending || all.isError}
                  onChange={(v) => update("city_slug", v)}
                  options={[
                    {
                      value: "",
                      label: all.isPending
                        ? t("Loading cities…", "دریافت شهرها…")
                        : t("Choose a city", "انتخاب شهر"),
                    },
                    ...(all.data?.cities || []).map((c) => ({
                      value: c,
                      label: city(c),
                    })),
                  ]}
                />
                {error("city_slug")}
              </label>
              <label className="field">
                <span>{t("Neighborhood", "محله")}</span>
                <Picker
                  searchable
                  name="neighborhood_slug"
                  label={t("Property neighborhood", "محله ملک")}
                  disabled={!fields.city_slug || local.isPending}
                  value={fields.neighborhood_slug}
                  onChange={(v) => update("neighborhood_slug", v)}
                  options={[
                    { value: "", label: t("Any / unknown", "همه / نامشخص") },
                    ...(local.data?.neighborhoods || []).map((c) => ({
                      value: c,
                      label: city(c),
                    })),
                  ]}
                />
              </label>
              <label className="field field-wide">
                <span>{t("Property type", "نوع ملک")} *</span>
                <Picker
                  name="cat3_slug"
                  label={t("Property type", "نوع ملک")}
                  value={fields.cat3_slug}
                  onChange={(v) => update("cat3_slug", v)}
                  options={[
                    {
                      value: "apartment-sell",
                      label: t("Apartment", "آپارتمان"),
                    },
                    {
                      value: "house-villa-sell",
                      label: t("House / Villa", "خانه / ویلا"),
                    },
                  ]}
                />
              </label>
              <label className="field">
                <span>{t("Building Area (m²)", "مساحت بنا (مترمربع)")} *</span>
                <input
                  name="building_size"
                  aria-required="true"
                  aria-invalid={!!errors.building_size}
                  inputMode="decimal"
                  placeholder={t("e.g. 90", "مثلاً ۹۰")}
                  value={fields.building_size}
                  onChange={(e) => update("building_size", e.target.value)}
                />
                <small className="field-hint">
                  {t(
                    "Greater than 0, up to 10,000 m²",
                    "بیشتر از صفر تا ۱۰٬۰۰۰ مترمربع",
                  )}
                </small>
                {error("building_size")}
              </label>
              <label className="field">
                <span>{t("Number of Bedrooms", "تعداد اتاق‌خواب")} *</span>
                <Picker
                  name="rooms_count"
                  label={t("Number of Bedrooms", "تعداد اتاق‌خواب")}
                  value={fields.rooms_count}
                  onChange={(v) => update("rooms_count", v)}
                  options={[
                    { value: "", label: t("Choose", "انتخاب کنید") },
                    ...Array.from({ length: 21 }, (_, i) => ({
                      value: String(i),
                      label: i === 0 ? t("Studio / 0", "بدون اتاق / ۰") : n(i),
                    })),
                  ]}
                />
                {error("rooms_count")}
              </label>
            </div>
            <details className="advanced-details">
              <summary>
                {t("Additional Property Details", "جزئیات بیشتر ملک")}
              </summary>
              <div className="field-grid">
                {(
                  [
                    {
                      key: "construction_year",
                      label: t(
                        "Construction year (Solar Hijri)",
                        "سال ساخت (هجری شمسی)",
                      ),
                    },
                    { key: "floor", label: t("Floor", "طبقه") },
                    {
                      key: "total_floors_count",
                      label: t("Total floors", "تعداد طبقات"),
                    },
                  ] as const
                ).map((f) => (
                  <label className="field" key={f.key}>
                    <span>{f.label}</span>
                    <input
                      name={f.key}
                      inputMode="numeric"
                      value={fields[f.key]}
                      placeholder={t("Unknown", "نامشخص")}
                      onChange={(e) => update(f.key, e.target.value)}
                    />
                    {error(f.key)}
                  </label>
                ))}
                {(
                  [
                    { key: "has_parking", label: t("Parking", "پارکینگ") },
                    { key: "has_elevator", label: t("Elevator", "آسانسور") },
                    { key: "has_balcony", label: t("Balcony", "بالکن") },
                    {
                      key: "has_warehouse",
                      label: t("Storage / Warehouse", "انباری"),
                    },
                  ] as const
                ).map((f) => (
                  <label className="field" key={f.key}>
                    <span>{f.label}</span>
                    <Picker
                      label={f.label}
                      name={f.key}
                      value={fields[f.key]}
                      onChange={(v) => update(f.key, v)}
                      options={options}
                    />
                  </label>
                ))}
                <p className="field-hint field-wide">
                  {t(
                    "Year: 1200–1500 Solar Hijri. Floor: −5–100; total floors: 1–100. A known floor cannot exceed the total. Leave unknown details blank; the model uses its fitted imputer, not invented property facts.",
                    "سال: ۱۲۰۰ تا ۱۵۰۰ هجری شمسی. طبقه: ۵− تا ۱۰۰؛ تعداد طبقات: ۱ تا ۱۰۰. طبقه نباید از تعداد طبقات بیشتر باشد. جزئیات نامشخص را خالی بگذارید؛ مدل از جایگزینی آموخته‌شده استفاده می‌کند، نه مشخصات ساختگی.",
                  )}
                </p>
              </div>
            </details>
            <label className="field">
              <span>
                {t(
                  "Your asking price (optional)",
                  "قیمت پیشنهادی شما (اختیاری)",
                )}
              </span>
              <input
                name="asking_price"
                inputMode="decimal"
                placeholder={t("Original source units", "واحد اصلی منبع")}
                value={asking}
                onChange={(e) => setAsking(e.target.value)}
              />
              <small className="field-hint">
                {t(
                  "For comparison only. Currency is not independently verified.",
                  "فقط برای مقایسه؛ واحد پول به‌طور مستقل تأیید نشده است.",
                )}
              </small>
              {error("asking")}
            </label>
            {Object.keys(errors).length > 0 && (
              <p
                role="alert"
                className="field-error"
                style={{ marginBlockStart: 15 }}
              >
                {t(
                  "Please correct the highlighted fields.",
                  "لطفاً فیلدهای مشخص‌شده را اصلاح کنید.",
                )}
              </p>
            )}
            {(all.isError || local.isError) && (
              <p role="alert" className="field-error">
                {t(
                  "Location options are unavailable. Please refresh or try again.",
                  "گزینه‌های مکان در دسترس نیستند. صفحه را تازه کنید یا دوباره تلاش کنید.",
                )}
              </p>
            )}
            <Button
              type="submit"
              disabled={mutation.isPending || all.isPending}
            >
              {mutation.isPending ? (
                <LoaderCircle size={17} className="loading-icon" />
              ) : (
                <Calculator size={17} />
              )}{" "}
              {mutation.isPending
                ? t("Estimating…", "در حال برآورد…")
                : t("Estimate Property Value", "برآورد ارزش ملک")}
              <ArrowRight size={16} />
            </Button>
            {status.data && !status.data.available && (
              <p className="field-hint" style={{ marginBlockStart: 12 }}>
                {t(
                  "Model unavailable. You can still search for comparable records.",
                  "مدل در دسترس نیست. جستجوی آگهی‌های مشابه همچنان ممکن است.",
                )}
              </p>
            )}
          </fieldset>
        </form>
        {mutation.isError ? (
          <div className="result-panel" role="alert">
            <h2>{t("Estimate unavailable", "برآورد در دسترس نیست")}</h2>
            <p style={{ marginBlock: "16px 0" }}>
              {t(
                "The request could not be completed. Your inputs are preserved.",
                "درخواست کامل نشد. اطلاعات شما حفظ شده است.",
              )}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (mutation.variables) mutation.mutate(mutation.variables);
              }}
            >
              {t("Try again", "تلاش دوباره")}
            </Button>
          </div>
        ) : mutation.data ? (
          <EstimateResult result={mutation.data} asking={asking} />
        ) : (
          <aside className="result-panel result-empty" aria-live="polite">
            <Calculator size={35} />
            <h2>
              {mutation.isPending
                ? t(
                    "Finding historical context…",
                    "در حال بررسی داده‌های تاریخی…",
                  )
                : t(
                    "Your estimate will appear here",
                    "برآورد شما اینجا نمایش داده می‌شود",
                  )}
            </h2>
            <p>
              {t(
                "Enter the essentials to see the model estimate, comparable median and matching historical properties.",
                "مشخصات اصلی را وارد کنید تا برآورد مدل، میانه قیمت مشابه و آگهی‌های تاریخی مرتبط را ببینید.",
              )}
            </p>
            <div className="small-note" style={{ marginBlockStart: 24 }}>
              <Check
                size={13}
                style={{ display: "inline", marginInlineEnd: 7 }}
              />
              {t(
                "No invented listings. No confidence claims.",
                "بدون آگهی ساختگی یا ادعای اطمینان آماری.",
              )}
            </div>
          </aside>
        )}
      </div>
      {mutation.data && (
        <>
          <ComparableResults result={mutation.data} />
          <CoverageNotice provenance={mutation.data.provenance} />
        </>
      )}
    </>
  );
}
function EstimateResult({
  result,
  asking,
}: {
  result: ValuationResult;
  asking: string;
}) {
  const { t, n } = useLanguage();
  const median =
    result.comparables.length >= 3 ? result.comparable_median_price : null;
  const price = asking.trim() ? parseNumber(asking) : NaN;
  return (
    <section
      className="result-panel"
      aria-label={t("Estimation result", "نتیجه برآورد")}
    >
      <span className="badge">
        {result.model.mode === "illustrative"
          ? t("Illustrative estimate", "برآورد نمایشی")
          : t("Historical estimate", "برآورد تاریخی")}
      </span>
      <div className="estimate-primary">
        <span>{t("Model Estimate", "برآورد مدل")}</span>
        {result.prediction ? (
          <>
            <strong className="prediction-number">
              {n(result.prediction.predicted_price, true)}
            </strong>
            <small>
              {n(result.prediction.predicted_price)} ·{" "}
              {t("original source units", "واحد اصلی منبع")}
            </small>
          </>
        ) : (
          <p style={{ marginBlockStart: 12 }}>
            {t(
              "Model unavailable. See the historical comparables below.",
              "مدل در دسترس نیست. آگهی‌های مشابه تاریخی را در پایین ببینید.",
            )}
          </p>
        )}
      </div>
      {result.prediction?.warnings.some((w) =>
        w.includes("absent from training"),
      ) && (
        <p className="small-note text-warning">
          {t(
            "This city was absent from model training. Treat the estimate with extra caution.",
            "این شهر در داده‌های آموزش مدل وجود نداشته است. برآورد را با احتیاط بیشتری بررسی کنید.",
          )}
        </p>
      )}
      <div className="estimate-secondary">
        <span>{t("Comparable Property Median", "میانه قیمت املاک مشابه")}</span>
        <strong>{median != null ? n(median, true) : "—"}</strong>
        <p className="small-note">
          {median != null
            ? t(
                "Descriptive median of the returned comparables; not the model prediction.",
                "میانه توصیفی قیمت آگهی‌های مشابه برگشتی؛ نه پیش‌بینی مدل.",
              )
            : t(
                "At least three comparables are needed for a useful median.",
                "برای ارائه میانه قابل استفاده، حداقل سه آگهی مشابه لازم است.",
              )}
        </p>
      </div>
      {Number.isFinite(price) && price > 0 && (
        <div className="comparison-grid">
          {[
            {
              label: t("Compared with model", "مقایسه با مدل"),
              value: result.prediction?.predicted_price,
            },
            {
              label: t("Compared with comparables", "مقایسه با آگهی‌های مشابه"),
              value: median,
            },
          ].map((c) => (
            <div key={c.label}>
              <span>{c.label}</span>
              <strong>
                {c.value ? n(100 * (price / c.value - 1)) + "%" : "—"}
              </strong>
              <span>
                {c.value
                  ? n(price - c.value, true) +
                    " " +
                    t("source units difference", "واحد منبع اختلاف")
                  : t("Not available", "موجود نیست")}
              </span>
            </div>
          ))}
          <p className="field-hint field-wide">
            {t(
              "Positive means your price is higher, negative means lower. A comparison, not a guarantee.",
              "عدد مثبت یعنی قیمت شما بالاتر است؛ عدد منفی یعنی پایین‌تر. این فقط مقایسه است، نه تضمین ارزش.",
            )}
          </p>
        </div>
      )}
      <details className="methodology">
        <summary>
          {t("How was this estimated?", "این برآورد چگونه محاسبه شد؟")}
        </summary>
        <p>
          {t(
            "The Random Forest uses the approved fitted model. Comparables are real same-city, same-type historical records ranked by characteristics. Their median is a separate descriptive measure.",
            "جنگل تصادفی از مدل آموزش‌دیده تأییدشده استفاده می‌کند. آگهی‌های مشابه، داده‌های واقعی تاریخی از همان شهر و نوع ملک هستند که بر اساس ویژگی‌ها رتبه‌بندی می‌شوند. میانه آن‌ها یک معیار توصیفی جداگانه است.",
          )}
        </p>
        <ul>
          <li>
            {t(
              "Trained on a limited subset, not all prepared records or every Iranian city.",
              "آموزش روی نمونه محدودی بوده، نه تمام آرشیو یا همه شهرهای ایران.",
            )}
          </li>
          <li>
            {t(
              "Unknown details use fitted training-data imputation; they are not known attributes.",
              "جزئیات نامشخص با مقادیر آموخته‌شده جایگزین می‌شوند؛ این‌ها مشخصات قطعی ملک نیستند.",
            )}
          </li>
          <li>
            {t(
              "Asking prices are not verified transactions or current-market guarantees.",
              "قیمت‌های پیشنهادی، معامله قطعی یا تضمین بازار امروز نیستند.",
            )}
          </li>
          <li>
            {t(
              "No calibrated confidence interval. Currency units remain unverified.",
              "بازه اطمینان کالیبره‌شده موجود نیست. واحد پول تأیید نشده است.",
            )}
          </li>
        </ul>
        <p>
          {t("Model version", "نسخه مدل")}:{" "}
          <code dir="ltr">{result.model.version || "—"}</code>
        </p>
        <Link href="/model" className="text-accent">
          {t("View model methodology", "مشاهده روش‌شناسی مدل")}
        </Link>
      </details>
    </section>
  );
}
