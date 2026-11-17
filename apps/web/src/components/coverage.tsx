import { Database, History, ScanLine } from "lucide-react";
import type { Provenance } from "@/lib/contracts";
export function CoverageNotice({ provenance }: { provenance: Provenance }) {
  const c = provenance.coverage;
  return (
    <section className="coverage-notice" aria-label="Data coverage">
      <div className="coverage-heading">
        <Database size={15} />
        <strong>
          {provenance.kind === "illustrative"
            ? "Offline illustrative records"
            : "Historical Divar records · Hugging Face"}
        </strong>
        <span>
          {c?.exhaustive ? "COMPLETE WITHIN SOURCE" : "BOUNDED RETRIEVAL"}
        </span>
      </div>
      <div className="coverage-facts">
        <span>
          <ScanLine size={12} />
          {c?.records_examined ?? provenance.input_rows}
          {c?.upstream_matching_rows != null
            ? ` / ${c.upstream_matching_rows.toLocaleString("en")}`
            : ""}{" "}
          source rows examined ·{" "}
          {c?.eligible_records ?? provenance.eligible_rows} eligible
        </span>
        <span>
          <History size={12} />
          {provenance.period_start || "Period not recorded"}
          {provenance.period_end ? ` – ${provenance.period_end}` : ""}
        </span>
        <code>rev {provenance.revision.slice(0, 12)}</code>
      </div>
      <p>
        {c?.bounded
          ? "Statistics and sorting describe retrieved records only. Not the entire city or market."
          : provenance.note}
      </p>
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
