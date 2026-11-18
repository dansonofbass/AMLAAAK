"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { City, Distributions } from "@/lib/contracts";
import { useLanguage } from "./language";
const colors = ["#4d9bd6", "#344351"];
const tip = {
  background: "#151e27",
  border: "1px solid #344351",
  borderRadius: 8,
  color: "#e8edf2",
  fontSize: 12,
};
const tick = { fontSize: 11, fill: "#8f9cab" };
export function Histogram({
  bins,
  onRange,
  unit = "",
  year = false,
}: {
  bins: Distributions["price"];
  onRange?: (min: number, max: number) => void;
  unit?: string;
  year?: boolean;
}) {
  const { n, t, year: formatYear } = useLanguage();
  const value = (v: number) => (year ? formatYear(v) : n(v, true));
  if (!bins.length)
    return (
      <div className="empty-chart">
        {t(
          "No observations in this selection.",
          "داده‌ای برای این انتخاب وجود ندارد.",
        )}
      </div>
    );
  return (
    <div className="chart-fill">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bins}
          margin={{ top: 10, right: 10, left: 0, bottom: 6 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#273441"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="lower"
            tickFormatter={(v) => value(Number(v))}
            tick={tick}
            axisLine={false}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(v) => n(Number(v), true)}
            allowDecimals={false}
            tick={tick}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip
            contentStyle={tip}
            cursor={{ fill: "#151e27" }}
            labelFormatter={(_, p) =>
              p?.length
                ? n(p[0].payload.lower, true) +
                  " – " +
                  n(p[0].payload.upper, true) +
                  " " +
                  unit
                : ""
            }
          />
          <Bar
            dataKey="count"
            name={t("Historical listings", "آگهی‌های تاریخی")}
            fill="#4d9bd6"
            radius={[3, 3, 0, 0]}
            maxBarSize={50}
            isAnimationActive={false}
          >
            {bins.map((b, i) => (
              <Cell
                key={i}
                cursor={onRange ? "pointer" : "default"}
                onClick={() => onRange?.(b.lower, b.upper)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CityBars({
  cities,
  onCity,
}: {
  cities: City[];
  onCity: (city: string) => void;
}) {
  const { n, city, t } = useLanguage();
  const data = cities.slice(0, 8);
  if (!data.length)
    return (
      <div className="empty-chart">
        {t("No cities in this selection.", "شهری برای این انتخاب وجود ندارد.")}
      </div>
    );
  return (
    <div className="chart-fill">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 15, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="#273441"
            strokeDasharray="3 5"
          />
          <XAxis
            type="number"
            tickFormatter={(v) => n(Number(v), true)}
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="city"
            tickFormatter={city}
            interval={0}
            width={85}
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tip}
            labelFormatter={(v) => city(String(v))}
            formatter={(v) => [
              n(Number(v)),
              t("Median / m²", "میانه / مترمربع"),
            ]}
          />
          <Bar
            dataKey="median_price_per_sqm"
            name={t("Median / m²", "میانه / مترمربع")}
            fill="#4d9bd6"
            radius={[0, 3, 3, 0]}
            maxBarSize={17}
            isAnimationActive={false}
          >
            {data.map((c) => (
              <Cell
                key={c.city}
                cursor="pointer"
                onClick={() => onCity(c.city)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function PropertyDonut({
  data,
  onType,
}: {
  data: Distributions["property_types"];
  onType: (kind: string) => void;
}) {
  const { property, n, t } = useLanguage();
  if (!data.some((r) => r.count))
    return (
      <div className="empty-chart">
        {t("No property types available.", "نوع ملک موجود نیست.")}
      </div>
    );
  return (
    <div className="donut-chart">
      <div className="chart-fill">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="57%"
              outerRadius="78%"
              stroke="#111922"
              strokeWidth={5}
              isAnimationActive={false}
            >
              {data.map((r, i) => (
                <Cell
                  key={r.label}
                  fill={colors[i % 2]}
                  onClick={() => onType(r.label)}
                  cursor="pointer"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tip}
              formatter={(v, name) => [n(Number(v)), property(String(name))]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="donut-legend">
        {data.map((r, i) => (
          <button key={r.label} onClick={() => onType(r.label)}>
            <i style={{ background: colors[i % 2] }} />
            {property(r.label)}
            <b>{n(r.count)}</b>
          </button>
        ))}
      </div>
    </div>
  );
}
export function AmenityBars({ data }: { data: Distributions["amenities"] }) {
  const { t, n } = useLanguage();
  const labels: Record<string, string> = {
    parking: t("Parking", "پارکینگ"),
    elevator: t("Elevator", "آسانسور"),
    balcony: t("Balcony", "بالکن"),
    warehouse: t("Storage", "انباری"),
  };
  return (
    <div className="chart-fill">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ right: 15 }}>
          <CartesianGrid
            horizontal={false}
            stroke="#273441"
            strokeDasharray="3 5"
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={tick}
            tickFormatter={(v) => n(Number(v)) + "%"}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickFormatter={(v) => labels[v] || v}
            width={85}
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tip}
            labelFormatter={(v) => labels[String(v)] || String(v)}
            formatter={(v) => [
              n(Number(v)) + "%",
              t("Present among known values", "موجود در مقادیر مشخص"),
            ]}
          />
          <Bar
            dataKey="percent"
            fill="#4d9bd6"
            maxBarSize={20}
            radius={[0, 3, 3, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CountArea({ bins }: { bins: Distributions["year"] }) {
  return <Histogram bins={bins} year />;
}
