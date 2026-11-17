"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  Compass,
  Expand,
  Layers3,
  MapPin,
  RotateCcw,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useAnalytics, useWorkspace } from "./workspace";
import {
  AmenityRadar,
  CityBars,
  CountArea,
  Histogram,
  PriceScatter,
  PropertyDonut,
} from "./charts";
import { Widget } from "./widget";
import { FiltersBar } from "./filters";
import { Button } from "./ui/button";
import { LoadingState, ErrorState, EmptyState } from "./status";
import { compact } from "@/lib/utils";
const IranMap = dynamic(() => import("./iran-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading geographic canvas…</div>,
});
export function Dashboard({ analytics = false }: { analytics?: boolean }) {
  const { summary, cities, distributions } = useAnalytics();
  const { filters, setFilters } = useWorkspace();
  const [layoutKey, setLayoutKey] = useState(0);
  const [mapReset, setMapReset] = useState(0);
  const [focusMap, setFocusMap] = useState(false);
  const data = summary.data,
    dist = distributions.data;
  if (summary.isError || cities.isError || distributions.isError)
    return (
      <ErrorState
        message={
          (summary.error || cities.error || distributions.error)?.message ||
          "Failed to fetch analytics"
        }
        retry={() => {
          summary.refetch();
          cities.refetch();
          distributions.refetch();
        }}
      />
    );
  if (!data || !dist || !cities.data) return <LoadingState />;
  const onCity = (city: string) =>
    setFilters({ ...filters, city: filters.city === city ? undefined : city });
  const onType = (property_type: string) =>
    setFilters({
      ...filters,
      property_type:
        filters.property_type === property_type ? undefined : property_type,
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE RESIDENTIAL MARKET, IN FOCUS</span>
          <h1>
            {analytics ? "Market analytics" : "Market overview"}
            <span className="heading-period">.</span>
          </h1>
          <p>
            {analytics
              ? "Explore the relationships behind the asking price."
              : "A geographic perspective on your property data."}
          </p>
        </div>
        <span
          className={`dataset-badge ${data.provenance.kind === "illustrative" ? "sample" : ""}`}
        >
          <span />
          {data.provenance.kind === "illustrative"
            ? "ILLUSTRATIVE SAMPLE"
            : "PREPARED SNAPSHOT"}
        </span>
      </div>
      <FiltersBar detailed={analytics} />
      <div className="kpi-grid">
        {[
          {
            label: "Eligible listings",
            value: String(data.count),
            detail: `of ${data.provenance.input_rows} source records`,
            icon: Building2,
          },
          {
            label: "Median asking price",
            value: compact(data.median_price),
            detail: `Mean ${compact(data.average_price)} · source units`,
            icon: CircleDollarSign,
          },
          {
            label: "Median price / m²",
            value: compact(data.median_price_per_sqm),
            detail: "Original source units per m²",
            icon: Ruler,
          },
          {
            label: "Cities represented",
            value: String(data.cities_count).padStart(2, "0"),
            detail: data.model.available
              ? data.model.mode === "illustrative"
                ? "Demo model available"
                : "Trained model available"
              : "Model not configured",
            icon: MapPin,
          },
        ].map((k, i) => (
          <section className={`kpi-card kpi-${i}`} key={k.label}>
            <div className="kpi-label">
              {k.label}
              <k.icon size={14} />
            </div>
            <strong>{k.value}</strong>
            <div className="kpi-detail">
              <span className="tiny-line" />
              {k.detail}
            </div>
          </section>
        ))}
      </div>
      {!data.count ? (
        <EmptyState reset={() => setFilters({})} />
      ) : (
        <>
          <div className={`geo-workspace ${focusMap ? "focus-map" : ""}`}>
            <div className="geo-topline">
              <span>
                <Compass size={13} />
                Geographic explorer{" "}
                <span className="map-level">IRAN / CITY LEVEL</span>
              </span>
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMapReset((v) => v + 1)}
                  title="Reset map view"
                  aria-label="Reset map view"
                >
                  <Compass size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLayoutKey((v) => v + 1)}
                  title="Reset widget layout"
                  aria-label="Reset widget layout"
                >
                  <RotateCcw size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFocusMap(!focusMap)}
                  title="Toggle map focus"
                  aria-label="Toggle map focus"
                >
                  <Expand size={13} />
                </Button>
              </div>
            </div>
            <div className="geo-map">
              <IranMap
                cities={cities.data}
                selected={filters.city}
                onSelect={onCity}
                reset={mapReset}
              />
            </div>
            <div key={layoutKey} className="widget-layer">
              <Widget
                title="Asking price distribution"
                label="Listings · original source units"
                className="w-price"
                movable
              >
                <Histogram
                  bins={dist.price}
                  onRange={(min, max) =>
                    setFilters({
                      ...filters,
                      price_min: String(min),
                      price_max: String(max),
                    })
                  }
                />
                <div className="chart-caption">
                  <i className="legend-violet" />
                  Fixed-price residential sales
                </div>
              </Widget>
              <Widget
                title="Property amenities"
                label="Present, as % of known values"
                className="w-radar"
                movable
              >
                <AmenityRadar data={dist.amenities} />
                <div className="chart-caption">
                  <i className="legend-cyan" />
                  Unknown amenities excluded
                </div>
              </Widget>
              <Widget
                title="Area × asking price"
                label={`One bubble per sale · ${dist.price_area.length} records shown`}
                className="w-scatter"
                movable
              >
                <PriceScatter data={dist.price_area} onCity={onCity} />
                <div className="chart-caption">
                  <span>Area (m²)</span>
                  <span>Click a bubble to select its city</span>
                </div>
              </Widget>
              <Widget
                title="Median asking price / m²"
                label="Compare the represented cities"
                className="w-cities"
                movable
              >
                <CityBars cities={cities.data} onCity={onCity} />
              </Widget>
            </div>
            <div className="map-legend">
              <div>
                <Layers3 size={13} />
                <strong>Map layers</strong>
              </div>
              <span className="legend-active">
                <i />
                Eligible city aggregates
              </span>
              <div className="legend-scale">
                <span>Fewer</span>
                <span>More listings</span>
              </div>
              <div className="gradient-scale" />
              <p>
                Bubble size = listing count
                <br />
                City centers, not property locations.
                <br />
                Country fill is geographic context.
              </p>
              <span className="north-label">N ↑</span>
            </div>
            <div className="map-status">
              <span className="status-dot" />
              {cities.data.filter((c) => c.latitude !== null).length} mapped
              cities · Select a marker to filter
            </div>
          </div>
          <div className="lower-charts">
            <Widget title="Property composition" label="Residential sale types">
              <PropertyDonut data={dist.property_types} onType={onType} />
            </Widget>
            <Widget
              title="Area distribution"
              label="Building area · square meters"
            >
              <Histogram
                bins={dist.area}
                color="#42d4e6"
                unit="m²"
                onRange={(min, max) =>
                  setFilters({
                    ...filters,
                    area_min: String(min),
                    area_max: String(max),
                  })
                }
              />
            </Widget>
            <Widget
              title="Construction year"
              label={`Solar Hijri · ${dist.missing_years} unknown`}
            >
              <CountArea bins={dist.year} />
            </Widget>
          </div>
        </>
      )}
      <div className="source-strip">
        <ShieldCheck size={17} />
        <div>
          <strong>
            {data.provenance.kind === "illustrative"
              ? "A transparent starting point."
              : "A documented data snapshot."}
          </strong>
          <p>
            {data.provenance.note} Results describe the current selection only.
          </p>
        </div>
        <Link href="/properties">
          Explore records <ArrowUpRight size={14} />
        </Link>
      </div>
    </>
  );
}
