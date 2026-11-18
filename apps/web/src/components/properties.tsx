"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import {
  propertyPageSchema,
  queryString,
  type Property,
  type Filters,
} from "@/lib/contracts";
import { useWorkspace } from "./workspace";
import { useLanguage } from "./language";
import { FiltersBar } from "./filters";
import { CoverageNotice } from "./coverage";
import { Picker } from "./ui/picker";
import { Button } from "./ui/button";
import { DetailDialog } from "./ui/dialog";
import { LoadingState, ErrorState, EmptyState } from "./status";
export function PropertiesPage() {
  const { filters } = useWorkspace();
  const { t } = useLanguage();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("EXPLORE / HISTORICAL SALES", "جستجو / فروش‌های تاریخی")}
          </span>
          <h1>{t("Explore Properties", "جستجوی ملک")}</h1>
          <p>
            {t(
              "Search the historical archive. No active availability or exact property locations are implied.",
              "آرشیو تاریخی را جستجو کنید. موجود بودن آگهی یا موقعیت دقیق ملک تأیید نمی‌شود.",
            )}
          </p>
        </div>
      </div>
      <FiltersBar detailed />
      <Explorer key={queryString(filters)} filters={filters} />
    </>
  );
}
function Explorer({ filters }: { filters: Filters }) {
  const { t, n, city, property, known, year: formatYear } = useLanguage();
  const { setFilters } = useWorkspace();
  const [page, setPage] = useState(1),
    [size, setSize] = useState(5),
    [sort, setSort] = useState("price_value:desc"),
    [selected, setSelected] = useState<Property | null>(null);
  const [field, order] = sort.split(":");
  const params = new URLSearchParams(queryString(filters));
  params.set("page", String(page));
  params.set("page_size", String(size));
  params.set("sort", field);
  params.set("order", order);
  const query = useQuery({
    queryKey: ["properties", params.toString()],
    queryFn: () => api("properties?" + params, propertyPageSchema),
  });
  if (query.isError)
    return (
      <ErrorState message={query.error.message} retry={() => query.refetch()} />
    );
  if (!query.data) return <LoadingState />;
  const data = query.data;
  return (
    <>
      {data.provenance && <CoverageNotice provenance={data.provenance} />}
      <section className="table-panel">
        <div className="table-toolbar">
          <div>
            <h2>
              {n(data.total)} {t("historical properties", "ملک تاریخی")}
            </h2>
            <p className="small-note">
              {t(
                "Asking prices in original source units",
                "قیمت‌های پیشنهادی با واحد اصلی منبع",
              )}
            </p>
          </div>
          <label className="field">
            <span>{t("Sort by", "مرتب‌سازی")}</span>
            <Picker
              label={t("Sort properties", "مرتب‌سازی املاک")}
              value={sort}
              onChange={(v) => {
                setSort(v);
                setPage(1);
              }}
              options={[
                {
                  value: "price_value:desc",
                  label: t("Price: high to low", "قیمت: بیشترین"),
                },
                {
                  value: "price_value:asc",
                  label: t("Price: low to high", "قیمت: کمترین"),
                },
                {
                  value: "building_size:desc",
                  label: t("Area: largest first", "مساحت: بیشترین"),
                },
                {
                  value: "building_size:asc",
                  label: t("Area: smallest first", "مساحت: کمترین"),
                },
                {
                  value: "price_per_sqm:desc",
                  label: t("Price / m²", "قیمت / مترمربع"),
                },
                {
                  value: "city_slug:asc",
                  label: t("City: source order", "شهر: ترتیب منبع"),
                },
              ]}
            />
          </label>
        </div>
        {!data.total ? (
          <EmptyState reset={() => setFilters({})} />
        ) : (
          <>
            <div className="table-scroll property-table">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Property", "ملک"),
                      t("Area", "مساحت"),
                      t("Bedrooms", "اتاق‌خواب"),
                      t("Year built", "سال ساخت"),
                      t("Asking price", "قیمت پیشنهادی"),
                      t("Ad period", "زمان آگهی"),
                      t("Details", "جزئیات"),
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{city(p.city_slug)}</strong>
                        <small>
                          {p.neighborhood_slug
                            ? city(p.neighborhood_slug) + " · "
                            : ""}
                          {property(p.cat3_slug)}
                        </small>
                      </td>
                      <td>
                        <bdi>{n(p.building_size)} m²</bdi>
                      </td>
                      <td>{n(p.rooms_count)}</td>
                      <td>{formatYear(p.construction_year)}</td>
                      <td className="numeric">
                        <strong>{n(p.price_value, true)}</strong>
                        <small>{n(p.price_per_sqm, true)} / m²</small>
                      </td>
                      <td>
                        <bdi dir="ltr">
                          {p.created_at_month || t("Not recorded", "ثبت نشده")}
                        </bdi>
                      </td>
                      <td>
                        <button
                          className="detail-link"
                          onClick={() => setSelected(p)}
                          aria-label={t(
                            "View property details",
                            "نمایش جزئیات ملک",
                          )}
                        >
                          <ArrowUpRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="property-mobile-list">
              {data.items.map((p) => (
                <article key={p.id}>
                  <div>
                    <h3>
                      {city(p.city_slug)}
                      {p.neighborhood_slug
                        ? " / " + city(p.neighborhood_slug)
                        : ""}
                    </h3>
                    <p>
                      {property(p.cat3_slug)} ·{" "}
                      <bdi>{n(p.building_size)} m²</bdi> · {n(p.rooms_count)}{" "}
                      {t("bedrooms", "اتاق‌خواب")}
                    </p>
                    <strong>{n(p.price_value, true)}</strong>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(p)}
                  >
                    {t("Details", "جزئیات")}
                  </Button>
                </article>
              ))}
            </div>
            <div className="pagination">
              <span>
                {n((page - 1) * size + 1)}–
                {n(Math.min(page * size, data.total))} {t("of", "از")}{" "}
                {n(data.total)}
              </span>
              <div className="pagination-controls">
                <Picker
                  label={t("Rows per page", "تعداد در صفحه")}
                  value={String(size)}
                  onChange={(v) => {
                    setSize(Number(v));
                    setPage(1);
                  }}
                  options={[5, 10, 25].map((v) => ({
                    value: String(v),
                    label: n(v),
                  }))}
                />
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page === 1 || query.isFetching}
                  onClick={() => setPage((v) => v - 1)}
                  aria-label={t("Previous page", "صفحه قبل")}
                >
                  <ChevronLeft size={17} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page * size >= data.total || query.isFetching}
                  onClick={() => setPage((v) => v + 1)}
                  aria-label={t("Next page", "صفحه بعد")}
                >
                  <ChevronRight size={17} />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
      <DetailDialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title={
          selected
            ? city(selected.city_slug) + " · " + property(selected.cat3_slug)
            : ""
        }
      >
        {selected && (
          <>
            <dl className="detail-grid">
              {[
                [
                  t("Neighborhood", "محله"),
                  selected.neighborhood_slug
                    ? city(selected.neighborhood_slug)
                    : t("Unknown", "نامشخص"),
                ],
                [
                  t("Asking price · source units", "قیمت پیشنهادی · واحد منبع"),
                  n(selected.price_value),
                ],
                [t("Area (m²)", "مساحت (مترمربع)"), n(selected.building_size)],
                [t("Bedrooms", "اتاق‌خواب"), n(selected.rooms_count)],
                [
                  t("Construction year", "سال ساخت"),
                  formatYear(selected.construction_year),
                ],
                [
                  t("Floor / total floors", "طبقه / تعداد طبقات"),
                  n(selected.floor) + " / " + n(selected.total_floors_count),
                ],
                [t("Parking", "پارکینگ"), known(selected.has_parking)],
                [t("Elevator", "آسانسور"), known(selected.has_elevator)],
                [t("Balcony", "بالکن"), known(selected.has_balcony)],
                [t("Storage", "انباری"), known(selected.has_warehouse)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="detail-provenance">
              <p>
                {t(
                  "Historical asking price; not an active listing or completed transaction.",
                  "قیمت پیشنهادی تاریخی؛ نه آگهی فعال و نه معامله قطعی.",
                )}
              </p>
              <p>
                {t("Advertisement month", "ماه آگهی")}:{" "}
                <bdi dir="ltr">{selected.created_at_month || "—"}</bdi>
              </p>
              <code dir="ltr">{selected.source_identity || selected.id}</code>
              <code dir="ltr">
                {selected.source_revision || data.provenance?.revision}
              </code>
            </div>
          </>
        )}
      </DetailDialog>
    </>
  );
}
