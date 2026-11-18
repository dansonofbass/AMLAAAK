"use client";
import { memo, useEffect, useState, useMemo } from "react";
import { useLanguage } from "./language";
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
import "leaflet/dist/leaflet.css";
import { containsPoint } from "@/lib/geography";

function markerColor(count: number, min: number, max: number) {
  const ratio = (count - min) / Math.max(1, max - min);
  return ratio > 0.66 ? "#76b7e8" : "#4d9bd6";
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
function IranMap({
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
  const { t, n, city: cityName, rtl } = useLanguage();
  const [geometry, setGeometry] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState(false);
  const [provinces, setProvinces] = useState<FeatureCollection | null>(null);
  const mappedCities = useMemo(
    () => cities.filter((c) => c.latitude !== null && c.longitude !== null),
    [cities],
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
      aria-label={t(
        "Interactive Iran city aggregation map",
        "نقشه تعاملی شهرهای ایران",
      )}
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
              color: f?.properties.name === "Iran" ? "#344351" : "#273441",
              weight: 1,
              fillColor: f?.properties.name === "Iran" ? "#151e27" : "#0e161e",
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
              key={`${feature.properties?.shapeID}-${selectedInside}-${rtl}`}
              data={feature}
              style={{
                color: selectedInside ? "#76b7e8" : "#344351",
                weight: selectedInside ? 2.5 : 0.8,
                fillColor: selectedInside ? "#4d9bd6" : "#151e27",
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
                    element.setAttribute(
                      "aria-label",
                      t(`${name} province`, `استان ${name}`),
                    );
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
                <strong>
                  {name} · {t("province (ADM1)", "استان (ADM1)")}
                </strong>
                <br />
                {inside.length
                  ? inside
                      .map(
                        (c) =>
                          `${cityName(c.city)}: ${n(c.count)} ${t("historical sales", "فروش تاریخی")}`,
                      )
                      .join(" · ")
                  : t(
                      "No mapped-city records in this selection",
                      "آگهی از شهرهای نقشه در این انتخاب موجود نیست",
                    )}
                <br />
                <small>
                  {t(
                    "Represented city counts only, not province totals.",
                    "فقط تعداد شهرهای نمایش‌داده‌شده، نه کل استان.",
                  )}
                </small>
              </Tooltip>
              <Popup>
                <strong>
                  {name} · {t("province", "استان")}
                </strong>
                <p>
                  {t(
                    "Choose a represented city:",
                    "شهر مورد نظر را انتخاب کنید:",
                  )}
                </p>
                {inside.length ? (
                  inside.map((c) => (
                    <button
                      className="province-city-choice"
                      key={c.city}
                      onClick={() => onSelect(c.city)}
                    >
                      {cityName(c.city)} · {n(c.count)}{" "}
                      {t("historical records", "آگهی تاریخی")}
                    </button>
                  ))
                ) : (
                  <span>
                    {t(
                      "No mapped cities in this selection.",
                      "شهر روی نقشه در این انتخاب موجود نیست.",
                    )}
                  </span>
                )}
              </Popup>
            </GeoJSON>
          );
        })}
        {mappedCities.map((city) => (
          <CircleMarker
            key={city.city + String(rtl)}
            center={[city.latitude!, city.longitude!]}
            radius={7 + Math.sqrt(city.count / maxCount) * 16}
            pathOptions={{
              color: markerColor(city.count, minCount, maxCount),
              fillColor: markerColor(city.count, minCount, maxCount),
              fillOpacity: 0.48,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onSelect(city.city),
              add: (e) => {
                const element = e.target.getElement?.();
                if (element) {
                  element.setAttribute("tabindex", "0");
                  element.setAttribute("role", "button");
                  element.setAttribute("data-city", city.city);
                  element.setAttribute(
                    "aria-label",
                    t("Select ", "انتخاب ") + cityName(city.city),
                  );
                  element.addEventListener(
                    "keydown",
                    (event: KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(city.city);
                      }
                    },
                  );
                }
              },
            }}
          >
            <Tooltip
              permanent={selected === city.city}
              direction="top"
              offset={[0, -12]}
              className="city-map-label"
            >
              <strong>{cityName(city.city)}</strong>
              <span>
                {n(city.count)} {t("sales", "فروش")} ·{" "}
                {n(city.median_price_per_sqm, true)}/m²
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {error && (
        <div className="map-error">
          {t(
            "Boundaries could not load. City markers remain available.",
            "مرزها دریافت نشدند؛ نشانگرهای شهر همچنان در دسترس‌اند.",
          )}
        </div>
      )}
      <span className="map-country-label">{rtl ? "ایران" : "I R A N"}</span>
    </div>
  );
}
export default memo(IranMap);
