import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { it, expect } from "vitest";
import { Button } from "../src/components/ui/button";
import { ErrorState, EmptyState } from "../src/components/status";
import { CoverageNotice } from "../src/components/coverage";
import type { Provenance } from "../src/lib/contracts";
it("renders a real disabled button", () => {
  const html = renderToStaticMarkup(<Button disabled>Predict</Button>);
  expect(html).toContain("disabled");
  expect(html).toContain("Predict");
});
it("renders errors as accessible alerts", () => {
  const html = renderToStaticMarkup(
    <ErrorState message="Backend offline" retry={() => {}} />,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("Backend offline");
  expect(html).toContain("Try again");
});
it("provides a reset action for empty selections", () => {
  const html = renderToStaticMarkup(<EmptyState reset={() => {}} />);
  expect(html).toContain("No matching sales");
  expect(html).toContain("Reset filters");
});

it("shows prepared archive counts separately from current-request reads and model training", () => {
  const provenance: Provenance = {
    kind: "divar", provider: "prepared", source_url: "https://huggingface.co/datasets/test/private",
    source_sha256: "a".repeat(64), revision: "b".repeat(40), input_rows: 1000000,
    eligible_rows: 400000, units: "Original units", note: "Historical sales archive",
    coverage: {
      records_examined: 0, normalized_records: 400000, eligible_records: 200,
      upstream_matching_rows: 400000, exhaustive: true, bounded: false, sampled: false,
      statistics_full_population: true, remote_filter_supported: false,
      remote_sort_supported: true, sorting_scope: "complete_prepared_query",
      method: "prepared_precomputed_aggregates", limitations: [], source_processing_complete: true,
    },
  };
  const html = renderToStaticMarkup(<CoverageNotice provenance={provenance} />);
  expect(html).toContain("400,000");
  expect(html).toContain("available historical sales");
  expect(html).toContain("Pinned source inventory verified complete");
  expect(html).toContain("model was not retrained");
  expect(html).not.toContain("source rows examined");
  const partial = renderToStaticMarkup(<CoverageNotice provenance={{...provenance,
    coverage: {...provenance.coverage!, source_processing_complete: false}}} />);
  expect(partial).toContain("has not been verified");
  const unavailable = renderToStaticMarkup(<CoverageNotice provenance={{...provenance,
    coverage: {...provenance.coverage!, exhaustive: false, bounded: true}}} />);
  expect(unavailable).toContain("ARCHIVE UNAVAILABLE");
  expect(unavailable).not.toContain("available historical sales");
});
