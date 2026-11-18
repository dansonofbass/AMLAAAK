"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  MapPin,
  Ruler,
  RotateCcw,
} from "lucide-react";
import { useAnalytics, useWorkspace } from "./workspace";
import {
  Histogram,
  CityBars,
  PropertyDonut,
  AmenityBars,
  CountArea,
} from "./charts";
import { FiltersBar } from "./filters";
import { CoverageNotice } from "./coverage";
import { ErrorState, LoadingState, EmptyState } from "./status";
import { useLanguage } from "./language";
import { Button } from "./ui/button";
const IranMap = dynamic(() => import("./iran-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      …
    </div>
  ),
});
function Chart({
  title,
  subtitle,
  children,
  caption,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  caption: string;
}) {
  return (
    <section className="chart-panel">
      <h3>{title}</h3>
      <p>{subtitle}</p>
      {children}
      <div className="chart-caption">{caption}</div>
    </section>
  );
}
export function Dashboard({ analytics = false }: { analytics?: boolean }) {
  const { summary, cities, distributions } = useAnalytics();
  const { filters, setFilters } = useWorkspace();
  const { t, n, city } = useLanguage();
  const [reset, setReset] = useState(0);
  const onCity = useCallback(
    (value: string) =>
      setFilters({
        ...filters,
        city: filters.city === value ? undefined : value,
        neighborhood: undefined,
      }),
    [filters, setFilters],
  );
  const onType = (value: string) =>
    setFilters({
      ...filters,
      property_type: filters.property_type === value ? undefined : value,
    });
  function range(field: "price" | "area", min: number, max: number) {
    if (filters.city)
      setFilters({
        ...filters,
        [field + "_min"]: String(min),
        [field + "_max"]: String(max),
      });
  }
  const data = summary.data,
    dist = distributions.data;
  const retry = () => {
    summary.refetch();
    cities.refetch();
    distributions.refetch();
  };
  const caption = t(
    "Historical records in the current selection.",
    "داده‌های تاریخی در انتخاب فعلی.",
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("AMLAAAK / HISTORICAL MARKET", "املاک / بازار تاریخی")}
          </span>
          <h1>
            {analytics
              ? t("Market Analytics", "تحلیل بازار")
              : t("Real Estate Market Overview", "نمای کلی بازار مسکن")}
          </h1>
          <p>
            {analytics
              ? t(
                  "Compare cities and understand the characteristics behind historical asking prices.",
                  "شهرها و ویژگی‌های مؤثر بر قیمت‌های پیشنهادی تاریخی را مقایسه کنید.",
                )
              : t(
                  "A clearer view of Iran’s historical housing market. Explore a city to see its story.",
                  "نگاهی روشن‌تر به بازار تاریخی مسکن ایران. برای بررسی جزئیات، یک شهر را انتخاب کنید.",
                )}
          </p>
        </div>
      </div>
      <FiltersBar detailed={analytics} />
      {summary.isError || cities.isError || distributions.isError ? (
        <ErrorState
          message={
            (summary.error || cities.error || distributions.error)?.message ||
            ""
          }
          retry={retry}
        />
      ) : !data || !dist || !cities.data ? (
        <LoadingState />
      ) : (
        <>
          <CoverageNotice provenance={data.provenance} />
          <div className="kpi-grid">
            {[
              {
                label: t("Historical Listings", "آگهی‌های تاریخی"),
                value: n(data.count),
                detail: t("Matching this selection", "مطابق انتخاب شما"),
                Icon: Building2,
              },
              {
                label: t("Median Asking Price", "میانه قیمت پیشنهادی"),
                value: n(data.median_price, true),
                detail: t("Original source units", "واحد اصلی منبع"),
                Icon: CircleDollarSign,
              },
              {
                label: t("Median Price / m²", "میانه قیمت / مترمربع"),
                value: n(data.median_price_per_sqm, true),
                detail: t("Original source units / m²", "واحد منبع / مترمربع"),
                Icon: Ruler,
              },
              {
                label: t("Cities Covered", "شهرهای پوشش داده شده"),
                value: n(data.cities_count),
                detail: t(
                  "With eligible historical sales",
                  "دارای آگهی فروش معتبر تاریخی",
                ),
                Icon: MapPin,
              },
            ].map(({ label, value, detail, Icon }) => (
              <section className="kpi-card" key={label}>
                <div className="kpi-label">
                  {label}
                  <Icon size={17} />
                </div>
                <strong className="numeric">{value}</strong>
                <div className="kpi-detail">{detail}</div>
              </section>
            ))}
          </div>
          {!data.count ? (
            <EmptyState reset={() => setFilters({})} />
          ) : (
            <>
              {!analytics && (
                <section className="panel map-panel">
                  <div className="map-toolbar">
                    <div>
                      <h2>
                        {t(
                          "Explore the market, city by city",
                          "بازار را شهر به شهر بررسی کنید",
                        )}
                      </h2>
                      <p>
                        {filters.city
                          ? city(filters.city)
                          : t(
                              "Select a marker or use the city search above.",
                              "یک نشانگر یا جستجوی شهر در بالا را انتخاب کنید.",
                            )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilters({
                          ...filters,
                          city: undefined,
                          neighborhood: undefined,
                        });
                        setReset((v) => v + 1);
                      }}
                    >
                      <RotateCcw size={14} />
                      {t("Reset Map", "بازنشانی نقشه")}
                    </Button>
                  </div>
                  <div className="map-wrap">
                    <IranMap
                      cities={cities.data}
                      selected={filters.city}
                      onSelect={onCity}
                      reset={reset}
                    />
                  </div>
                  <div className="map-caption">
                    <span>
                      {t(
                        "Approximate city centers · Marker size represents listing count.",
                        "مرکز تقریبی شهرها · اندازه نشانگر متناسب با تعداد آگهی‌هاست.",
                      )}
                    </span>
                    <span>
                      {n(cities.data.filter((c) => c.latitude != null).length)}{" "}
                      {t(
                        "cities mapped · province outlines, not property pins",
                        "شهر روی نقشه · مرز استان‌ها، نه موقعیت ملک",
                      )}
                    </span>
                  </div>
                </section>
              )}
              <div className="section-heading">
                <div>
                  <h2>
                    {analytics
                      ? t("Market comparisons", "مقایسه بازار")
                      : t("The market at a glance", "بازار در یک نگاه")}
                  </h2>
                  <p>
                    {filters.city
                      ? t(
                          "Select a chart bar to refine this city’s price or area range.",
                          "برای محدود کردن قیمت یا مساحت در این شهر، ستون نمودار را انتخاب کنید.",
                        )
                      : t(
                          "Select a city before applying numeric ranges.",
                          "پیش از اعمال بازه عددی، یک شهر را انتخاب کنید.",
                        )}
                  </p>
                </div>
                <span className="small-note">{caption}</span>
              </div>
              <div className="chart-grid">
                <Chart
                  title={t("Asking Price Distribution", "توزیع قیمت پیشنهادی")}
                  subtitle={t(
                    "Listings by asking-price range · source units",
                    "تعداد آگهی در بازه‌های قیمت · واحد منبع",
                  )}
                  caption={caption}
                >
                  <Histogram
                    bins={dist.price}
                    onRange={
                      filters.city ? (a, b) => range("price", a, b) : undefined
                    }
                  />
                </Chart>
                <Chart
                  title={t(
                    "Median Price per Square Meter by City",
                    "میانه قیمت هر مترمربع در شهرها",
                  )}
                  subtitle={t(
                    "Up to 8 cities with the most matching records",
                    "تا ۸ شهر با بیشترین آگهی مطابق انتخاب",
                  )}
                  caption={t(
                    "Click a city bar to select it. Currency units are unverified.",
                    "برای انتخاب شهر، روی ستون آن کلیک کنید. واحد پول تأیید نشده است.",
                  )}
                >
                  <CityBars cities={cities.data} onCity={onCity} />
                </Chart>
                {!analytics && (
                  <>
                    <Chart
                      title={t("Property Type Distribution", "توزیع نوع ملک")}
                      subtitle={t(
                        "Eligible apartment and house / villa sales",
                        "آگهی‌های معتبر فروش آپارتمان و خانه / ویلا",
                      )}
                      caption={caption}
                    >
                      <PropertyDonut
                        data={dist.property_types}
                        onType={onType}
                      />
                    </Chart>
                    <Chart
                      title={t("Area Distribution", "توزیع مساحت")}
                      subtitle={t(
                        "Building area in square meters",
                        "مساحت بنا بر حسب مترمربع",
                      )}
                      caption={caption}
                    >
                      <Histogram
                        bins={dist.area}
                        unit="m²"
                        onRange={
                          filters.city
                            ? (a, b) => range("area", a, b)
                            : undefined
                        }
                      />
                    </Chart>
                  </>
                )}
              </div>
              {analytics && (
                <details className="advanced-details" open>
                  <summary>
                    {t("Property characteristics", "ویژگی‌های ملک")}
                  </summary>
                  <div className="panel-body chart-grid">
                    <Chart
                      title={t("Amenities", "امکانات")}
                      subtitle={t(
                        "Percentage among records where the feature is known",
                        "درصد در میان آگهی‌هایی که مقدار ویژگی مشخص است",
                      )}
                      caption={t(
                        "Unknown values are excluded, not treated as No.",
                        "مقادیر نامشخص حذف شده‌اند، نه اینکه «خیر» در نظر گرفته شوند.",
                      )}
                    >
                      <AmenityBars data={dist.amenities} />
                    </Chart>
                    <Chart
                      title={t("Construction Year", "سال ساخت")}
                      subtitle={t(
                        "Solar Hijri year groups",
                        "بازه‌های سال هجری شمسی",
                      )}
                      caption={
                        n(dist.missing_years) +
                        " " +
                        t(
                          "records have unknown construction year.",
                          "آگهی سال ساخت نامشخص دارند.",
                        )
                      }
                    >
                      <CountArea bins={dist.year} />
                    </Chart>
                  </div>
                </details>
              )}
              {!analytics && (
                <div className="context-action">
                  <div>
                    <h3>
                      {t(
                        "What might a home like yours be worth?",
                        "ارزش تقریبی ملکی مانند ملک شما چقدر است؟",
                      )}
                    </h3>
                    <p>
                      {t(
                        "Explore a research estimate alongside real historical comparables.",
                        "یک برآورد پژوهشی را در کنار آگهی‌های تاریخی مشابه بررسی کنید.",
                      )}
                    </p>
                  </div>
                  <Button asChild>
                    <Link href="/predict">
                      {t("Open Price Estimator", "رفتن به برآورد قیمت")}
                      <ArrowUpRight size={16} />
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
