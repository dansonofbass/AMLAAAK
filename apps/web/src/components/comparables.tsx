"use client";
import { BedDouble, Ruler, CalendarDays } from "lucide-react";
import { z } from "zod";
import { valuationSchema } from "@/lib/contracts";
import { useLanguage } from "./language";
export type ValuationResult = z.infer<typeof valuationSchema>;
export function ComparableResults({ result }: { result: ValuationResult }) {
  const { t, n, city, property, language, year: formatYear } = useLanguage();
  function reason(value: string) {
    if (language === "en") return value;
    const fixed: Record<string, string> = {
      "Same city": "همان شهر",
      "Same residential sale category": "همان نوع ملک مسکونی",
      "Same neighborhood": "همان محله",
      "Different or unknown neighborhood": "محله متفاوت یا نامشخص",
      "Bedrooms unknown": "تعداد اتاق‌خواب نامشخص",
      "Parking matches": "پارکینگ مشابه",
      "Elevator matches": "آسانسور مشابه",
      "Balcony matches": "بالکن مشابه",
      "Warehouse matches": "انباری مشابه",
      "Advertisement period unknown": "زمان آگهی نامشخص",
    };
    if (fixed[value]) return fixed[value];
    const area = value.match(/^Area differs by ([\d.]+)/);
    if (area) return "اختلاف مساحت: " + n(Number(area[1])) + " مترمربع";
    const rooms = value.match(/^([\d.]+) bedrooms/);
    if (rooms) return n(Number(rooms[1])) + " اتاق‌خواب";
    const year = value.match(/^Construction year differs by ([\d.]+)/);
    if (year) return "اختلاف سال ساخت: " + n(Number(year[1])) + " سال";
    const date = value.match(/^Advertisement ([\d.]+) month/);
    if (date) return n(Number(date[1])) + " ماه فاصله با جدیدترین آگهی مقایسه";
    return "مقایسه ویژگی‌های تاریخی";
  }
  return (
    <section
      className="comparable-section"
      aria-label={t("Comparable property results", "نتایج املاک مشابه")}
    >
      <div className="section-heading">
        <div>
          <h2>{t("Comparable Properties", "املاک مشابه")}</h2>
          <p>
            {t(
              "Actual historical records from the same city and property type. Matching is a heuristic, not a probability.",
              "آگهی‌های واقعی تاریخی از همان شهر و نوع ملک. تطبیق بر اساس قواعد است، نه احتمال آماری.",
            )}
          </p>
        </div>
        <span className="badge">
          {n(result.comparables.length)} {t("comparables", "ملک مشابه")}
        </span>
      </div>
      {!result.comparables.length ? (
        <div className="state-card">
          <h3>
            {t("No comparable records available", "آگهی مشابهی در دسترس نیست")}
          </h3>
          <p>
            {result.coverage.method === "upstream_unavailable"
              ? t(
                  "The archive could not be reached. No sample records have been substituted.",
                  "دسترسی به آرشیو ممکن نشد. هیچ داده نمایشی جایگزین نشده است.",
                )
              : t(
                  "Try another city or property type. This does not mean no such homes exist.",
                  "شهر یا نوع ملک دیگری را امتحان کنید. این نتیجه به معنی نبودن چنین املاکی نیست.",
                )}
          </p>
        </div>
      ) : (
        <div className="comparable-grid">
          {result.comparables.map(({ property: p, reasons }) => (
            <article className="comparable-card" key={p.id}>
              <p className="card-type">{property(p.cat3_slug)}</p>
              <h3>
                {city(p.city_slug)}
                {p.neighborhood_slug ? " / " + city(p.neighborhood_slug) : ""}
              </h3>
              <strong className="card-price numeric">
                {n(p.price_value, true)}
              </strong>
              <span className="small-note">
                {t("asking price · source units", "قیمت پیشنهادی · واحد منبع")}
              </span>
              <div className="card-specs">
                <span>
                  <Ruler size={13} />
                  <bdi>{n(p.building_size)} m²</bdi>
                </span>
                <span>
                  <BedDouble size={13} />
                  {n(p.rooms_count)}
                </span>
                <span>
                  <CalendarDays size={13} />
                  {formatYear(p.construction_year)}
                </span>
              </div>
              <details className="match-reasons">
                <summary>{t("Why this property?", "چرا این ملک؟")}</summary>
                <ul>
                  {reasons.map((r, i) => (
                    <li key={i}>{reason(r)}</li>
                  ))}
                </ul>
              </details>
              <p className="record-period">
                {t("Historical ad", "آگهی تاریخی")} ·{" "}
                <bdi dir="ltr">
                  {p.created_at_month || t("Month unknown", "ماه نامشخص")}
                </bdi>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
