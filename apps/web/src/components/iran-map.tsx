"use client";
import { useEffect, useState } from "react";
import {
  MapContainer,
  GeoJSON,
  CircleMarker,
  Tooltip,
  ZoomControl,
  useMap,
  Popup,
} from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { City } from "@/lib/contracts";
import { compact, title } from "@/lib/utils";
import "leaflet/dist/leaflet.css";
import { containsPoint } from "@/lib/geography";

function markerColor(count: number, min: number, max: number) {
  const ratio = (count - min) / Math.max(1, max - min);
  return `rgb(${Math.round(156 - 86 * ratio)}, ${Math.round(138 + 75 * ratio)}, ${Math.round(250 - 27 * ratio)})`;
}
function MapSync({
  selected,
  cities,
  reset,
}: {
  selected?: string;
  cities: City[];
  reset: number;
}) {
  const map = useMap();
  useEffect(() => {
    const city = cities.find((c) => c.city === selected);
    if (city?.latitude && city?.longitude)
      map.setView([city.latitude, city.longitude], 6, { animate: false });
    else
      map.fitBounds(
        [
          [24.5, 44],
          [40, 63.5],
        ],
        { padding: [12, 12], maxZoom: 5, animate: false },
      );
  }, [selected, cities, map, reset]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
export default function IranMap({
  cities,
  selected,
  onSelect,
  reset = 0,
}: {
  cities: City[];
  selected?: string;
  onSelect: (city: string) => void;
  reset?: number;
}) {
  const [geometry, setGeometry] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState(false);
  const [provinces, setProvinces] = useState<FeatureCollection | null>(null);
  const mappedCities = cities.filter(
    (c) => c.latitude !== null && c.longitude !== null,
  );
  const maxCount = Math.max(1, ...mappedCities.map((c) => c.count));
  const minCount = Math.min(maxCount, ...mappedCities.map((c) => c.count));
  useEffect(() => {
    fetch("/region.geojson")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setGeometry)
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    fetch("/iran-provinces.geojson")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setProvinces)
      .catch(() => setError(true));
  }, []);
  return (
    <div
      className="map-surface"
      aria-label="Interactive Iran city aggregation map"
    >
      <MapContainer
        center={[32.5, 54.5]}
        zoom={5}
        minZoom={4}
        maxZoom={9}
        zoomControl={false}
        scrollWheelZoom={false}
        attributionControl
      >
        <ZoomControl position="topright" />
        <MapSync selected={selected} cities={cities} reset={reset} />
        {geometry && (
          <GeoJSON
            data={geometry}
            style={(f) => ({
              color: f?.properties.name === "Iran" ? "#499ba6" : "#3b4453",
              weight: 1,
              fillColor: f?.properties.name === "Iran" ? "#205663" : "#202632",
              fillOpacity: f?.properties.name === "Iran" ? 0.8 : 0.7,
            })}
            attribution='<a href="https://www.naturalearthdata.com/">Natural Earth</a> · City centers only'
          />
        )}
        {provinces?.features.map((feature) => {
          const inside = mappedCities.filter((c) =>
            containsPoint(feature, c.longitude!, c.latitude!),
          );
          const selectedInside = inside.some((c) => c.city === selected);
          const name = String(
            feature.properties?.shapeName || "Unnamed administrative area",
          );
          return (
            <GeoJSON
              key={`${feature.properties?.shapeID}-${selectedInside}`}
              data={feature}
              style={{
                color: selectedInside ? "#b6a4ff" : "#648b9b",
                weight: selectedInside ? 2.5 : 0.8,
                fillColor: selectedInside ? "#7867b9" : "#28616e",
                fillOpacity: selectedInside ? 0.42 : 0.14,
                className: `province-boundary ${selectedInside ? "province-selected" : ""}`,
              }}
              eventHandlers={{
                click: () => {
                  if (inside.length === 1) onSelect(inside[0].city);
                },
              }}
              onEachFeature={(_, layer) => {
                layer.on("add", () => {
                  const element = (
                    layer as unknown as { getElement: () => SVGElement }
                  ).getElement?.();
                  if (element) {
                    element.setAttribute("data-province", name);
                    element.setAttribute("aria-label", `${name} province`);
                    element.setAttribute("tabindex", "0");
                    element.setAttribute("role", "button");
                    element.addEventListener("keydown", (event) => {
                      if (event.key === "Enter" && inside.length === 1)
                        onSelect(inside[0].city);
                    });
                  }
                });
              }}
              attribution='<a href="https://www.geoboundaries.org/">geoBoundaries</a> · OSM / ODbL · ADM1 provinces (2017)'
            >
              <Tooltip direction="top" sticky>
                <strong>{name} · province (ADM1)</strong>
                <br />
                {inside.length
                  ? inside
                      .map(
                        (c) => `${title(c.city)}: ${c.count} retrieved sales`,
                      )
                      .join(" · ")
                  : "No mapped-city records in current selection"}
                <br />
                <small>
                  Only represented city counts, not province-wide totals.
                </small>
              </Tooltip>
              <Popup>
                <strong>{name} province</strong>
                <p>Choose a represented city:</p>
                {inside.length ? (
                  inside.map((c) => (
                    <button
                      className="province-city-choice"
                      key={c.city}
                      onClick={() => onSelect(c.city)}
                    >
                      {title(c.city)} · {c.count} retrieved records
                    </button>
                  ))
                ) : (
                  <span>No mapped city candidates in this window.</span>
                )}
              </Popup>
            </GeoJSON>
          );
        })}
        {mappedCities.map((city, i) => (
          <CircleMarker
            key={city.city}
            center={[city.latitude!, city.longitude!]}
            radius={7 + Math.sqrt(city.count / maxCount) * 16}
            pathOptions={{
              color: markerColor(city.count, minCount, maxCount),
              fillColor: markerColor(city.count, minCount, maxCount),
              fillOpacity: 0.48,
              weight: 2,
            }}
            eventHandlers={{ click: () => onSelect(city.city) }}
          >
            <Tooltip
              permanent={
                !mappedCities
                  .slice(0, i)
                  .some(
                    (c) =>
                      c.latitude !== null &&
                      c.longitude !== null &&
                      Math.abs(c.latitude - city.latitude!) < 0.7 &&
                      Math.abs(c.longitude - city.longitude!) < 0.7,
                  )
              }
              direction="top"
              offset={[0, -12]}
              className="city-map-label"
            >
              <strong>{title(city.city)}</strong>
              <span>
                {city.count} sale{city.count === 1 ? "" : "s"} ·{" "}
                {compact(city.median_price_per_sqm)}/m²
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {error && (
        <div className="map-error">
          Country boundaries could not load. City markers remain available.
        </div>
      )}
      <span className="map-country-label">I R A N</span>
      <span className="map-sea-label">PERSIAN GULF</span>
    </div>
  );
}
