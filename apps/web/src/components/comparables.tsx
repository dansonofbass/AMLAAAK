"use client";
import {
  BedDouble,
  CalendarDays,
  CarFront,
  Check,
  DoorOpen,
  MapPin,
  Ruler,
  Warehouse,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";
import { valuationSchema } from "@/lib/contracts";
import { compact, propertyLabel, title } from "@/lib/utils";
import { CoverageNotice } from "./coverage";
export function ComparableResults({
  data,
}: {
  data: z.infer<typeof valuationSchema>;
}) {
  const bars = [
    ...(data.prediction
      ? [{ name: "ML estimate", price: data.prediction.predicted_price }]
      : []),
    ...(data.comparable_median_price !== null
      ? [{ name: "Comparable median", price: data.comparable_median_price }]
      : []),
  ];
  return (
    <section
      role="region"
      className="comparable-section"
      aria-label="Comparable property results"
    >
      <div className="section-heading">
        <MapPin size={20} />
        <div>
          <h2>Comparable historical properties</h2>
          <p>{data.label}</p>
        </div>
        <span className="dataset-badge">{data.comparables.length} MATCHES</span>
      </div>
      <CoverageNotice provenance={data.provenance} />
      <div className="comparison-summary">
        <div>
          <span className="eyebrow">RETRIEVED COMPARABLE MEDIAN</span>
          <strong>{compact(data.comparable_median_price)}</strong>
          <p>
            {compact(data.comparable_median_price_per_sqm)} / m² · original
            source units
          </p>
        </div>
        <div>
          <span className="eyebrow">MODEL VS. COMPARABLES</span>
          <strong>
            {data.prediction_vs_comparable_percent !== null
              ? `${data.prediction_vs_comparable_percent > 0 ? "+" : ""}${data.prediction_vs_comparable_percent.toFixed(1)}%`
              : "—"}
          </strong>
          <p>
            {data.prediction
              ? "Descriptive comparison, not an accuracy score."
              : "Comparables work without an available model."}
          </p>
        </div>
        {bars.length > 0 && (
          <div className="comparison-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bars}
                layout="vertical"
                margin={{ left: 0, right: 20 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={compact}
                  tick={{ fontSize: 10, fill: "#a0abc0" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={105}
                  tick={{ fontSize: 10, fill: "#cbd3e4" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#202a3c",
                    border: "1px solid #52627d",
                    borderRadius: 8,
                  }}
                  formatter={(v) => compact(Number(v))}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="price"
                  radius={[0, 4, 4, 0]}
                >
                  {bars.map((b, i) => (
                    <Cell key={b.name} fill={i ? "#51d4dd" : "#a38bf4"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {!data.comparables.length ? (
        <div className="state-card">
          <h3>No eligible comparables in the retrieved records</h3>
          <p>
            This does not mean there are no matching homes in the full dataset.
            Broader source coverage may be needed.
          </p>
        </div>
      ) : (
        <div className="comparable-grid">
          {data.comparables.map(
            ({ property: p, similarity_score, reasons }) => (
              <article className="comparable-card" key={p.id}>
                <div className="comparable-card-top">
                  <span className="property-category">
                    {propertyLabel(p.cat3_slug)}
                  </span>
                  <span className="similarity-score">
                    {similarity_score.toFixed(0)}{" "}
                    <small>/ 100 similarity</small>
                  </span>
                </div>
                <h3>
                  <MapPin size={14} />
                  {title(p.city_slug)}
                  {p.neighborhood_slug && (
                    <span> / {title(p.neighborhood_slug)}</span>
                  )}
                </h3>
                <div className="comparable-price">
                  {compact(p.price_value)}
                  <small>{compact(p.price_per_sqm)} / m²</small>
                </div>
                <div className="property-specs">
                  <span>
                    <Ruler size={13} />
                    {p.building_size} m²
                  </span>
                  <span>
                    <BedDouble size={13} />
                    {p.rooms_count ?? "Unknown"} bedrooms
                  </span>
                  <span>
                    <CalendarDays size={13} />
                    Built {p.construction_year ?? "unknown"} SH
                  </span>
                </div>
                <div className="comparable-amenities">
                  {[
                    { key: "has_parking", label: "Parking", icon: CarFront },
                    { key: "has_elevator", label: "Elevator", icon: DoorOpen },
                    { key: "has_balcony", label: "Balcony", icon: DoorOpen },
                    {
                      key: "has_warehouse",
                      label: "Warehouse",
                      icon: Warehouse,
                    },
                  ].map((item) => {
                    const value = p[item.key as "has_parking"];
                    return (
                      <span
                        key={item.key}
                        className={value === true ? "present" : "unknown"}
                        title={`${item.label}: ${value === null ? "unknown" : value ? "yes" : "no"}`}
                      >
                        <item.icon size={12} />
                        {item.label}
                        {value === true ? (
                          <Check size={10} />
                        ) : value === false ? (
                          <X size={10} />
                        ) : (
                          <small>?</small>
                        )}
                      </span>
                    );
                  })}
                </div>
                <details>
                  <summary>Why this property matches</summary>
                  <ul>
                    {reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </details>
                <div className="comparable-source">
                  <span>
                    <CalendarDays size={12} />
                    {p.created_at_month || "Period unknown"} · historical, not
                    active
                  </span>
                  <strong>
                    {data.provenance.kind === "divar"
                      ? "Genuine Divar source record"
                      : "Illustrative fixture record"}
                  </strong>
                  <code title={p.source_identity || p.id}>
                    {p.source_identity || `fixture:${p.id}`}
                  </code>
                </div>
              </article>
            ),
          )}
        </div>
      )}
      <details className="valuation-limitations">
        <summary>Coverage and methodology limitations</summary>
        <ul>
          {data.limitations.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
