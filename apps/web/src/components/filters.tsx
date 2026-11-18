"use client";
import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useWorkspace, useFacets } from "./workspace";
import { Picker } from "./ui/picker";
import { Button } from "./ui/button";
import { useLanguage, parseNumber } from "./language";
import type { Filters } from "@/lib/contracts";
export function FiltersBar({ detailed = false }: { detailed?: boolean }) {
  const { filters, setFilters } = useWorkspace();
  const all = useFacets(),
    local = useFacets(filters.city);
  const { t, city } = useLanguage();
  const [draft, setDraft] = useState<Filters>({});
  const [error, setError] = useState("");
  function clear() {
    setFilters({});
    setDraft({});
    setError("");
  }
  function apply() {
    const merged = { ...filters, ...draft };
    for (const field of ["area", "price", "year"] as const) {
      const low = merged[(field + "_min") as keyof Filters],
        high = merged[(field + "_max") as keyof Filters];
      const invalid = [low, high].some(
        (v) =>
          v !== undefined &&
          v !== "" &&
          (!Number.isFinite(parseNumber(v)) ||
            parseNumber(v) < 0 ||
            (field === "year" &&
              (!Number.isInteger(parseNumber(v)) ||
                parseNumber(v) < 1200 ||
                parseNumber(v) > 1500))),
      );
      if (invalid || (low && high && parseNumber(low) > parseNumber(high))) {
        setError(
          t(
            "Check the ranges. Minimum must not exceed maximum; years use Solar Hijri 1200–1500.",
            "بازه‌ها را بررسی کنید. حداقل نباید بیشتر از حداکثر باشد؛ سال باید هجری شمسی بین ۱۲۰۰ تا ۱۵۰۰ باشد.",
          ),
        );
        return;
      }
      for (const bound of ["min", "max"]) {
        const key = (field + "_" + bound) as keyof Filters;
        const v = merged[key];
        merged[key] = v ? String(parseNumber(v)) : undefined;
      }
    }
    setFilters(merged);
    setDraft({});
    setError("");
  }
  return (
    <>
      <div className="filter-bar">
        <label className="field">
          <span>{t("City", "شهر")}</span>
          <Picker
            searchable
            label={t("Selected city", "شهر انتخاب‌شده")}
            value={filters.city || ""}
            onChange={(v) => {
              setFilters({
                ...filters,
                city: v || undefined,
                neighborhood: undefined,
              });
              setDraft({});
            }}
            options={[
              { value: "", label: t("All Cities", "همه شهرها") },
              ...(all.data?.cities || []).map((c) => ({
                value: c,
                label: city(c),
              })),
            ]}
          />
        </label>
        {detailed && (
          <label className="field">
            <span>{t("Neighborhood", "محله")}</span>
            <Picker
              searchable
              label={t("Neighborhood filter", "فیلتر محله")}
              disabled={!filters.city || local.isPending}
              value={filters.neighborhood || ""}
              onChange={(v) =>
                setFilters({ ...filters, neighborhood: v || undefined })
              }
              options={[
                { value: "", label: t("All neighborhoods", "همه محله‌ها") },
                ...(local.data?.neighborhoods || []).map((c) => ({
                  value: c,
                  label: city(c),
                })),
              ]}
            />
          </label>
        )}
        <label className="field">
          <span>{t("Property type", "نوع ملک")}</span>
          <Picker
            label={t("Property type filter", "فیلتر نوع ملک")}
            value={filters.property_type || ""}
            onChange={(v) =>
              setFilters({ ...filters, property_type: v || undefined })
            }
            options={[
              { value: "", label: t("All property types", "همه انواع ملک") },
              { value: "apartment-sell", label: t("Apartment", "آپارتمان") },
              {
                value: "house-villa-sell",
                label: t("House / Villa", "خانه / ویلا"),
              },
            ]}
          />
        </label>
        <Button variant="ghost" onClick={clear}>
          <X size={16} />
          {t("Clear Filters", "پاک کردن فیلترها")}
        </Button>
      </div>
      {(all.isError || local.isError) && (
        <p className="field-error" role="alert">
          {t(
            "Location options could not load. Retry from the page or refresh.",
            "گزینه‌های مکان دریافت نشدند. دوباره تلاش کنید یا صفحه را تازه کنید.",
          )}
        </p>
      )}
      {detailed && (
        <details className="advanced-details">
          <summary>
            <SlidersHorizontal
              size={15}
              style={{ display: "inline", marginInlineEnd: 8 }}
            />
            {t("More filters", "فیلترهای بیشتر")}
          </summary>
          <div className="panel-body">
            <p className="small-note" style={{ marginBlockEnd: 15 }}>
              {t(
                "Select a city to enable numeric and text filters.",
                "برای فعال شدن فیلترهای عددی و متنی، یک شهر انتخاب کنید.",
              )}
            </p>
            <div className="advanced-filters" style={{ padding: 0 }}>
              {(
                [
                  {
                    key: "area",
                    label: t("Building area (m²)", "مساحت بنا (مترمربع)"),
                  },
                  {
                    key: "price",
                    label: t(
                      "Asking price · source units",
                      "قیمت پیشنهادی · واحد منبع",
                    ),
                  },
                  { key: "year", label: t("Construction year", "سال ساخت") },
                ] as const
              ).map((f) => (
                <div className="field" key={f.key}>
                  <span>{f.label}</span>
                  <div className="range-pair">
                    {(["min", "max"] as const).map((bound) => {
                      const key = (f.key + "_" + bound) as keyof Filters;
                      return (
                        <input
                          key={bound}
                          inputMode="decimal"
                          disabled={!filters.city}
                          aria-label={
                            f.label +
                            " " +
                            t(
                              bound === "min" ? "minimum" : "maximum",
                              bound === "min" ? "حداقل" : "حداکثر",
                            )
                          }
                          placeholder={t(
                            bound === "min" ? "Min" : "Max",
                            bound === "min" ? "حداقل" : "حداکثر",
                          )}
                          value={draft[key] ?? filters[key] ?? ""}
                          onChange={(e) =>
                            setDraft({ ...draft, [key]: e.target.value })
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <label className="field">
                <span>{t("Search records", "جستجوی آگهی")}</span>
                <input
                  aria-label={t("Search listings", "جستجوی آگهی‌ها")}
                  disabled={!filters.city}
                  value={draft.search ?? filters.search ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, search: e.target.value })
                  }
                  placeholder={t(
                    "City, type or record ID",
                    "شهر، نوع یا شناسه آگهی",
                  )}
                />
              </label>
            </div>
            {error && (
              <p
                role="alert"
                className="field-error"
                style={{ marginBlockStart: 12 }}
              >
                {error}
              </p>
            )}
            <div className="filter-actions">
              <Button disabled={!filters.city} onClick={apply}>
                {t("Apply filters", "اعمال فیلترها")}
              </Button>
            </div>
          </div>
        </details>
      )}
    </>
  );
}
