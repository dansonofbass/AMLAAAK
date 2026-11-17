"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  FlaskConical,
  Info,
  Layers3,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  modelSchema,
  predictionInputSchema,
  valuationSchema,
  type PredictionInput,
} from "@/lib/contracts";
import { useAnalytics, useFacets } from "./workspace";
import { Picker } from "./ui/picker";
import { ComparableResults } from "./comparables";
import { Button } from "./ui/button";
import { compact, title } from "@/lib/utils";
export function PredictionPage() {
  const { summary } = useAnalytics();
  const [city, setCity] = useState("tehran");
  const [neighborhood, setNeighborhood] = useState("");
  const [propertyType, setPropertyType] = useState("apartment-sell");
  const allFacets = useFacets();
  const cityFacets = useFacets(city);
  const status = useQuery({
    queryKey: ["model-status"],
    queryFn: () => api("model/status", modelSchema),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const mutation = useMutation({
    mutationFn: (body: PredictionInput) =>
      api("valuation", valuationSchema, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      city_slug: city,
      neighborhood_slug: neighborhood || null,
      cat3_slug: propertyType,
      ...Object.fromEntries(
        [
          "building_size",
          "rooms_count",
          "floor",
          "total_floors_count",
          "construction_year",
        ].map((k) => [k, form.get(k) === "" ? NaN : Number(form.get(k))]),
      ),
      ...Object.fromEntries(
        ["has_parking", "has_elevator", "has_balcony", "has_warehouse"].map(
          (k) => [k, form.get(k) === "on"],
        ),
      ),
    };
    const parsed = predictionInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setErrors({});
    setDirty(false);
    mutation.mutate(parsed.data);
  };
  const result = mutation.data?.prediction;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FROM PROPERTY FEATURES TO AN ESTIMATE</span>
          <h1>
            Price prediction<span className="heading-period">.</span>
          </h1>
          <p>
            Model valuation and explainable historical comparables, side by
            side.
          </p>
        </div>
        <span className="dataset-badge sample">
          <FlaskConical size={12} />
          RESEARCH PROTOTYPE
        </span>
      </div>
      <div
        className={`model-notice ${status.data?.available ? "" : "unavailable"}`}
      >
        <Info size={17} />
        <div>
          <strong>
            {status.data?.available
              ? status.data.mode === "illustrative"
                ? "Illustrative model connected"
                : "Trained model connected"
              : "Model unavailable"}
          </strong>
          <p>
            {status.error?.message ||
              status.data?.message ||
              "Checking model status…"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => status.refetch()}>
          Refresh status
        </Button>
      </div>
      <div className="prediction-grid">
        <form
          className="prediction-form"
          noValidate
          onSubmit={submit}
          onChange={() => {
            setDirty(true);
          }}
        >
          <div className="section-heading">
            <span className="section-icon">
              <Building2 size={18} />
            </span>
            <div>
              <h2>Describe the property</h2>
              <p>Residential sale listings only</p>
            </div>
            <span className="step-number">01 / 02</span>
          </div>
          <div className="form-grid">
            <label>
              City *
              <Picker
                searchable
                name="city_slug"
                label="Property city"
                value={city}
                onChange={(value) => {
                  setCity(value);
                  setNeighborhood("");
                  setDirty(true);
                }}
                options={Array.from(
                  new Set([
                    city,
                    ...(allFacets.data?.cities ||
                      summary.data?.available_cities ||
                      []),
                  ]),
                ).map((c) => ({ value: c, label: title(c) }))}
              />
              <small id="city-help">
                Use the source city slug. Unseen cities have no learned city
                effect.
              </small>
              {errors.city_slug && (
                <span className="form-error">{errors.city_slug}</span>
              )}
            </label>
            <label>
              Property type *
              <Picker
                name="cat3_slug"
                label="Property type"
                value={propertyType}
                onChange={(value) => {
                  setPropertyType(value);
                  setDirty(true);
                }}
                options={[
                  { value: "apartment-sell", label: "Apartment" },
                  { value: "house-villa-sell", label: "House / villa" },
                ]}
              />
            </label>
            <label>
              Neighborhood{" "}
              <small>Optional, within retrieved city records</small>
              <Picker
                searchable
                name="neighborhood_slug"
                label="Property neighborhood"
                value={neighborhood}
                onChange={(value) => {
                  setNeighborhood(value);
                  setDirty(true);
                }}
                options={[
                  { value: "", label: "Any / unknown neighborhood" },
                  ...(cityFacets.data?.neighborhoods || []).map((n) => ({
                    value: n,
                    label: title(n),
                  })),
                ]}
              />
            </label>
            {[
              {
                name: "building_size",
                label: "Building area",
                unit: "m²",
                value: 90,
                min: 1,
                max: 10000,
                step: "any",
              },
              {
                name: "rooms_count",
                label: "Bedrooms",
                unit: "rooms",
                value: 2,
                min: 0,
                max: 20,
              },
              {
                name: "floor",
                label: "Floor",
                unit: "level",
                value: 2,
                min: -5,
                max: 100,
              },
              {
                name: "total_floors_count",
                label: "Total floors",
                unit: "floors",
                value: 5,
                min: 1,
                max: 100,
              },
              {
                name: "construction_year",
                label: "Construction year",
                unit: "Solar Hijri",
                value: 1395,
                min: 1200,
                max: 1500,
              },
            ].map((field) => (
              <label key={field.name}>
                {field.label} *
                <div className="input-with-unit">
                  <input
                    name={field.name}
                    type="number"
                    defaultValue={field.value}
                    min={field.min}
                    max={field.max}
                    step={field.step || 1}
                    aria-invalid={!!errors[field.name]}
                  />
                  <span>{field.unit}</span>
                </div>
                {errors[field.name] && (
                  <span className="form-error">{errors[field.name]}</span>
                )}
              </label>
            ))}
          </div>
          <fieldset className="amenity-inputs">
            <legend>Property amenities</legend>
            {["parking", "elevator", "balcony", "warehouse"].map((feature) => (
              <label key={feature}>
                <input
                  name={`has_${feature}`}
                  type="checkbox"
                  defaultChecked={
                    feature === "parking" || feature === "elevator"
                  }
                />
                <span className="checkbox-indicator">
                  <Check size={12} />
                </span>
                {title(feature)}
              </label>
            ))}
          </fieldset>
          <div className="form-note">
            <ShieldCheck size={15} />
            <p>
              No address, contact information, or personal data is requested or
              stored.
            </p>
          </div>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="predict-button"
          >
            {mutation.isPending ? (
              <LoaderCircle size={16} className="loading-icon" />
            ) : (
              <Sparkles size={16} />
            )}
            Estimate asking price <ArrowRight size={16} />
          </Button>
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="form-error">
              Please correct the highlighted property fields.
            </p>
          )}
          {mutation.error && (
            <p role="alert" className="form-error">
              {mutation.error.message}
            </p>
          )}
        </form>
        <div className="prediction-results">
          <div className="section-heading">
            <span className="section-icon">
              <Layers3 size={18} />
            </span>
            <div>
              <h2>Your estimate</h2>
              <p>Calculated by the configured model</p>
            </div>
            <span className="step-number">02 / 02</span>
          </div>
          {result ? (
            <div
              className={`result-card ${dirty ? "result-stale" : ""}`}
              aria-live="polite"
            >
              <span className="eyebrow">
                {result.model.mode === "illustrative"
                  ? "ILLUSTRATIVE MODEL OUTPUT"
                  : "MODEL ESTIMATE"}
              </span>
              <strong className="prediction-number">
                {compact(result.predicted_price)}
              </strong>
              <p>{result.units}</p>
              <div className="result-per-sqm">
                <span>Asking price / m²</span>
                <strong>{compact(result.price_per_sqm)}</strong>
              </div>
              <div className="exact-estimate">
                Exact output:{" "}
                {result.predicted_price.toLocaleString("en", {
                  maximumFractionDigits: 2,
                })}
              </div>
              {dirty && (
                <p className="form-error">
                  Inputs changed. Run the model again to update this estimate.
                </p>
              )}
              <div className="model-signature">
                <span>Random Forest</span>
                <code>{result.model.version}</code>
              </div>
            </div>
          ) : (
            <div className="result-placeholder">
              <div className="orbit-icon">
                <Sparkles size={28} />
              </div>
              <h3>
                {status.data?.available
                  ? "Ready when you are."
                  : "Waiting for a model."}
              </h3>
              <p>
                {status.data?.available
                  ? "Set the property features and run an estimate. Results are returned by the Python model."
                  : "Comparable search works without a model. Configure a trusted artifact bundle to add an ML estimate."}
              </p>
              <span className="empty-price">
                — <small>source units</small>
              </span>
            </div>
          )}
          <div className="prediction-caveats">
            <CircleAlert size={17} />
            <h3>Read before using an estimate</h3>
            <ul>
              {(
                result?.warnings || [
                  "Asking prices are not completed-sale prices.",
                  "Illustrative models do not establish market accuracy.",
                  "No confidence interval or investment recommendation is provided.",
                  "Currency units remain unverified.",
                ]
              ).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {mutation.data && <ComparableResults data={mutation.data} />}
    </>
  );
}
