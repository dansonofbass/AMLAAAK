"use client";
import { useState } from "react";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useWorkspace } from "./workspace";
import { Button } from "./ui/button";
import { title } from "@/lib/utils";
import type { Filters } from "@/lib/contracts";
export function FiltersBar({ detailed = false }: { detailed?: boolean }) {
  const { filters, setFilters } = useWorkspace();
  const [open, setOpen] = useState(detailed);
  const [draft, setDraft] = useState<Filters>({});
  const [error, setError] = useState("");
  const count = Object.entries(filters).filter(([, v]) => v).length;
  return (
    <div className="filters-wrap">
      <div className="filters-bar">
        <span className="eyebrow">RESIDENTIAL SALES</span>
        <span className="filter-divider" />
        <select
          aria-label="Property type filter"
          value={filters.property_type || ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              property_type: e.target.value || undefined,
            })
          }
        >
          <option value="">All property types</option>
          <option value="apartment-sell">Apartment</option>
          <option value="house-villa-sell">House / villa</option>
        </select>
        {filters.city && (
          <button
            className="filter-chip"
            onClick={() => setFilters({ ...filters, city: undefined })}
          >
            {title(filters.city)} <X size={11} />
          </button>
        )}
        <div className="filter-actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(filters);
              setOpen(!open);
            }}
          >
            <SlidersHorizontal size={13} />
            Filters{count > 0 && <b>{count}</b>}
          </Button>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({});
                setDraft({});
                setError("");
              }}
            >
              <RotateCcw size={12} />
              Reset
            </Button>
          )}
        </div>
      </div>
      {open && (
        <form
          className="advanced-filters"
          onSubmit={(e) => {
            e.preventDefault();
            for (const field of ["area", "price", "year"]) {
              const low = draft[`${field}_min` as keyof Filters],
                high = draft[`${field}_max` as keyof Filters];
              if (low && high && Number(low) > Number(high)) {
                setError(`${title(field)} minimum cannot exceed maximum`);
                return;
              }
            }
            setError("");
            setFilters({ ...filters, ...draft });
          }}
        >
          {(["area", "price", "year"] as const).map((field) => (
            <fieldset key={field}>
              <legend>
                {field === "area"
                  ? "Area (m²)"
                  : field === "price"
                    ? "Asking price (source units)"
                    : "Construction year (Solar Hijri)"}
              </legend>
              {(["min", "max"] as const).map((bound) => (
                <input
                  key={bound}
                  aria-label={`${field} ${bound}`}
                  placeholder={bound === "min" ? "Minimum" : "Maximum"}
                  type="number"
                  min={field === "year" ? 1200 : 0}
                  max={field === "year" ? 1500 : undefined}
                  step={field === "year" ? 1 : "any"}
                  value={draft[`${field}_${bound}`] || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [`${field}_${bound}`]: e.target.value,
                    })
                  }
                />
              ))}
            </fieldset>
          ))}
          <Button size="sm" type="submit">
            Apply filters
          </Button>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
