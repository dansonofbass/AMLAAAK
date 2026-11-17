import { z } from "zod";
export const modelSchema = z.object({
  available: z.boolean(),
  mode: z.enum(["unavailable", "illustrative", "trained"]),
  name: z.string(),
  version: z.string().nullable(),
  message: z.string(),
  source_revision: z.string().nullable().optional(),
});
export const coverageSchema = z.object({
  records_examined: z.number(),
  normalized_records: z.number(),
  eligible_records: z.number(),
  upstream_matching_rows: z.number().nullable(),
  exhaustive: z.boolean(),
  bounded: z.boolean(),
  sampled: z.boolean(),
  statistics_full_population: z.boolean(),
  remote_filter_supported: z.boolean(),
  remote_sort_supported: z.boolean(),
  sorting_scope: z.string(),
  method: z.string(),
  limitations: z.array(z.string()),
  source_processing_complete: z.boolean().nullable().optional(),
});
export const provenanceSchema = z.object({
  kind: z.enum(["illustrative", "divar"]),
  source_url: z.string(),
  source_sha256: z.string().nullable(),
  revision: z.string(),
  input_rows: z.number(),
  eligible_rows: z.number(),
  units: z.string(),
  note: z.string(),
  provider: z.string().default("snapshot"),
  coverage: coverageSchema.nullable().optional(),
  fetched_at: z.string().nullable().optional(),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
});
export const summarySchema = z.object({
  count: z.number(),
  median_price: z.number().nullable(),
  average_price: z.number().nullable(),
  median_price_per_sqm: z.number().nullable(),
  cities_count: z.number(),
  available_cities: z.array(z.string()),
  provenance: provenanceSchema,
  model: modelSchema,
});
export const citySchema = z.object({
  city: z.string(),
  count: z.number(),
  median_price: z.number(),
  median_price_per_sqm: z.number(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});
const binSchema = z.object({
  label: z.string(),
  lower: z.number(),
  upper: z.number(),
  count: z.number(),
});
export const distributionsSchema = z.object({
  price: z.array(binSchema),
  area: z.array(binSchema),
  year: z.array(binSchema),
  property_types: z.array(z.object({ label: z.string(), count: z.number() })),
  amenities: z.array(
    z.object({
      label: z.string(),
      present: z.number(),
      known: z.number(),
      percent: z.number().nullable(),
    }),
  ),
  price_area: z.array(
    z.object({
      id: z.string(),
      city: z.string(),
      area: z.number(),
      price: z.number(),
    }),
  ),
  missing_years: z.number(),
  coverage: coverageSchema.nullable().optional(),
});
export const propertySchema = z.object({
  id: z.string(),
  city_slug: z.string(),
  cat3_slug: z.enum(["apartment-sell", "house-villa-sell"]),
  building_size: z.number(),
  price_value: z.number(),
  price_per_sqm: z.number(),
  rooms_count: z.number().nullable(),
  floor: z.number().nullable(),
  total_floors_count: z.number().nullable(),
  construction_year: z.number().nullable(),
  has_parking: z.boolean().nullable(),
  has_elevator: z.boolean().nullable(),
  has_balcony: z.boolean().nullable(),
  has_warehouse: z.boolean().nullable(),
  neighborhood_slug: z.string().nullable().optional(),
  created_at_month: z.string().nullable().optional(),
  source_identity: z.string().nullable().optional(),
  source_revision: z.string().nullable().optional(),
  source_row_index: z.number().nullable().optional(),
});
export const propertyPageSchema = z.object({
  items: z.array(propertySchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  coverage: coverageSchema.nullable().optional(),
  provenance: provenanceSchema.nullable().optional(),
});
export const metricsSchema = z.object({
  status: modelSchema,
  scores: z
    .record(
      z.string(),
      z.object({ mae: z.number(), rmse: z.number(), r2: z.number() }),
    )
    .nullable(),
  train_rows: z.number().nullable(),
  test_rows: z.number().nullable(),
  input_rows: z.number().nullable(),
  eligible_rows: z.number().nullable(),
  seed: z.number().nullable(),
  test_size: z.number().nullable(),
  features: z.array(z.string()),
  source_sha256: z.string().nullable(),
  versions: z.record(z.string(), z.string()),
  residuals_available: z.boolean(),
  validation_rows: z.number().nullable().optional(),
  validation_metrics: z
    .object({ mae: z.number(), rmse: z.number(), r2: z.number() })
    .nullable()
    .optional(),
  split_method: z.string().nullable().optional(),
  source_revision: z.string().nullable().optional(),
});
export const predictionSchema = z.object({
  predicted_price: z.number(),
  price_per_sqm: z.number(),
  units: z.string(),
  model: modelSchema,
  warnings: z.array(z.string()),
});
export const predictionInputSchema = z
  .object({
    city_slug: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/, "Use a lowercase city slug"),
    neighborhood_slug: z.string().max(100).nullable().optional(),
    cat3_slug: z.enum(["apartment-sell", "house-villa-sell"]),
    building_size: z.number().positive().max(10000),
    rooms_count: z.number().int().min(0).max(20),
    floor: z.number().int().min(-5).max(100),
    total_floors_count: z.number().int().min(1).max(100),
    construction_year: z.number().int().min(1200).max(1500),
    has_parking: z.boolean(),
    has_elevator: z.boolean(),
    has_balcony: z.boolean(),
    has_warehouse: z.boolean(),
  })
  .refine((v) => v.floor <= v.total_floors_count, {
    message: "Floor cannot exceed total floors",
    path: ["floor"],
  });
export type Summary = z.infer<typeof summarySchema>;
export type City = z.infer<typeof citySchema>;
export type Distributions = z.infer<typeof distributionsSchema>;
export type Property = z.infer<typeof propertySchema>;
export type PredictionInput = z.infer<typeof predictionInputSchema>;
export type Filters = {
  city?: string;
  property_type?: string;
  area_min?: string;
  area_max?: string;
  price_min?: string;
  price_max?: string;
  year_min?: string;
  year_max?: string;
  search?: string;
  neighborhood?: string;
  bedrooms_min?: string;
  bedrooms_max?: string;
};
export const facetsSchema = z.object({
  cities: z.array(z.string()),
  neighborhoods: z.array(z.string()),
  provenance: provenanceSchema,
  coverage: coverageSchema,
});
export const valuationSchema = z.object({
  model: modelSchema,
  prediction: predictionSchema.nullable(),
  provenance: provenanceSchema,
  coverage: coverageSchema,
  comparables: z.array(
    z.object({
      property: propertySchema,
      similarity_score: z.number(),
      reasons: z.array(z.string()),
    }),
  ),
  comparable_median_price: z.number().nullable(),
  comparable_median_price_per_sqm: z.number().nullable(),
  prediction_vs_comparable_percent: z.number().nullable(),
  limitations: z.array(z.string()),
  label: z.string(),
});
export type Provenance = z.infer<typeof provenanceSchema>;
export function queryString(filters: Filters) {
  return new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "") as [
      string,
      string,
    ][],
  ).toString();
}
