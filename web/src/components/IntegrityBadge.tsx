// LOCAL — ships in the frontend bundle.
import { useState } from "react";
import { verifyIntegrity, IntegrityVerificationResult } from "../lib/api";

export default function IntegrityBadge() {
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [summary, setSummary] = useState({ total: 0, pendingRedaction: 0, visible: 0 });
  const [brokenAt, setBrokenAt] = useState<string>("");

  async function check() {
    setStatus("checking");
    try {
      const data: IntegrityVerificationResult = await verifyIntegrity();
      if (data.valid) {
        setStatus("valid");
        const total = data.entriesChecked || 0;
        const pendingRedaction = data.pendingRedactionEntries ?? data.deletedEntries ?? 0;
        setSummary({
          total,
          pendingRedaction,
          visible: data.visibleEntries ?? Math.max(total - pendingRedaction, 0),
        });
      } else {
        setStatus("invalid");
        setBrokenAt(data.brokenAt || "");
      }
    } catch {
      setStatus("invalid");
    }
  }

  return (
    <div className="integrity-row">
      <button className="link-button" onClick={check} disabled={status === "checking"}>
        {status === "checking" ? "Checking chain…" : "Verify journal integrity"}
      </button>
      {status === "valid" && (
        <span className="pill pill-verified integrity-summary">
          <strong>CHAIN INTACT</strong>
          <span className="integrity-summary-details">
            Total of {summary.total} {summary.total === 1 ? "entry" : "entries"} verified on server database, {summary.pendingRedaction} pending redaction, {summary.visible} visible {summary.visible === 1 ? "entry" : "entries"}
          </span>
        </span>
      )}
      {status === "invalid" && (
        <span className="pill pill-flagged">⚠ altered entry detected {brokenAt && `(broken at ${brokenAt.slice(0, 8)})`}</span>
      )}
    </div>
  );
}
