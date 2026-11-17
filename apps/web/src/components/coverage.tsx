import { Database, History, ScanLine } from "lucide-react";
import type { Provenance } from "@/lib/contracts";
export function CoverageNotice({ provenance }: { provenance: Provenance }) {
  const c = provenance.coverage;
  const prepared = provenance.provider === "prepared";
  return (
    <section className="coverage-notice" aria-label="Data coverage">
      <div className="coverage-heading">
        <Database size={15} />
        <strong>
          {provenance.kind === "illustrative"
            ? "Offline illustrative records"
            : prepared
              ? "Prepared historical Divar archive"
              : "Historical Divar records · Hugging Face"}
        </strong>
        <span>
          {prepared
            ? c?.exhaustive ? "COMPLETE ARCHIVE QUERY" : "ARCHIVE UNAVAILABLE"
            : c?.exhaustive ? "COMPLETE WITHIN SOURCE" : "BOUNDED RETRIEVAL"}
        </span>
      </div>
      <div className="coverage-facts">
        <span>
          <ScanLine size={12} />
          {prepared && !c?.exhaustive ? (
            <>Archive retrieval unavailable · no substitute records</>
          ) : prepared ? (
            <>
              {provenance.eligible_rows.toLocaleString("en")} available historical sales ·{" "}
              {(c?.eligible_records ?? provenance.eligible_rows).toLocaleString("en")} match
            </>
          ) : (<>
          {c?.records_examined ?? provenance.input_rows}
          {c?.upstream_matching_rows != null
            ? ` / ${c.upstream_matching_rows.toLocaleString("en")}`
            : ""}{" "}
          source rows examined ·{" "}
          {c?.eligible_records ?? provenance.eligible_rows} eligible
          </>)}
        </span>
        <span>
          <History size={12} />
          {provenance.period_start || "Period not recorded"}
          {provenance.period_end ? ` – ${provenance.period_end}` : ""}
        </span>
        <code>rev {provenance.revision.slice(0, 12)}</code>
      </div>
      <p>
        {c?.bounded && !prepared
          ? "Statistics and sorting describe retrieved records only. Not the entire city or market."
          : provenance.note}
      </p>
      {prepared && c?.exhaustive && (
        <small>
          {provenance.input_rows.toLocaleString("en")} source rows processed ·{" "}
          {c?.source_processing_complete
            ? "Pinned source inventory verified complete."
            : "Full pinned-source processing has not been verified."}{" "}
          Select a city before applying numeric or text filters. The model was not retrained.
        </small>
      )}
      {provenance.fetched_at && (
        <small>
          Retrieved {provenance.fetched_at.slice(0, 19).replace("T", " ")} UTC.
          Advertisement periods remain historical.
        </small>
      )}
      {c &&
        !c.remote_filter_supported &&
        provenance.provider === "huggingface" && (
          <small>
            Remote filtering is unavailable. City, neighborhood and numeric
            filters apply within the retrieved source window.
          </small>
        )}
    </section>
  );
}
