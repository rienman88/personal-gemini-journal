/**
 * LOCAL — ships in the frontend bundle.
 *
 * Read-only view of the current user's own recent audit events — the same
 * data that's always been written to `users/{uid}/audit`, now visible in
 * the app itself.
 */
import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

type AuditEventType =
  | "entry_created"
  | "reply_created"
  | "pii_detected"
  | "gemini_fallback"
  | "integrity_check"
  | "rate_limited"
  | "auth_rejected"
  | "data_deleted"
  | "entry_deleted"
  | "entry_redacted";

interface AuditEvent {
  id: string;
  type: AuditEventType;
  outcome: "success" | "failure";
  correlationId?: string;
  detail?: Record<string, unknown>;
  timestamp?: Timestamp;
}

type Tone = "neutral" | "positive" | "warning";

function describeEvent(event: AuditEvent): { label: string; detail?: string; tone: Tone } {
  switch (event.type) {
    case "entry_created":
      return { label: "Entry saved", tone: "neutral" };
    case "reply_created":
      return { label: "Reply saved", tone: "neutral" };
    case "pii_detected": {
      const categories = typeof event.detail?.categories === "string" ? event.detail.categories : undefined;
      return {
        label: "Privacy Guardian caught sensitive info",
        detail: categories?.replace(/_/g, " ").replace(/,/g, ", "),
        tone: "warning",
      };
    }
    case "gemini_fallback":
      return { label: "AI summary unavailable — entry saved regardless", tone: "warning" };
    case "integrity_check":
      return event.outcome === "success"
        ? { label: "Integrity verified", tone: "positive" }
        : { label: "Tamper detected", tone: "warning" };
    case "rate_limited":
      return { label: "Rate limit reached — request blocked", tone: "warning" };
    case "data_deleted":
      return { label: "Journal entries removed", tone: "neutral" };
    case "entry_deleted":
      return { label: "Entry removed from journal", tone: "neutral" };
    case "entry_redacted":
      return { label: "Retained entry privacy-redacted", tone: "positive" };
    case "auth_rejected":
      return { label: "Sign-in rejected", tone: "warning" };
    default:
      return { label: "Security event", tone: "neutral" };
  }
}

interface SecurityActivityProps {
  onClose?: () => void;
}

export default function SecurityActivity({ onClose }: SecurityActivityProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, `users/${uid}/audit`), orderBy("timestamp", "desc"), limit(15));
    return onSnapshot(
      q,
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEvent)));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  return (
    <div className="security-activity-card">
      <div className="security-activity-header">
        <p className="derived-label">RECENT SECURITY ACTIVITY</p>
        {onClose && (
          <button className="link-button" onClick={onClose} aria-label="Close security log">
            Close ✕
          </button>
        )}
      </div>

      {loading ? (
        <p className="security-activity-detail">Loading audit log…</p>
      ) : events.length === 0 ? (
        <p className="security-activity-detail">No security events recorded yet. Create an entry or trigger Privacy Guardian to log events.</p>
      ) : (
        <ul className="security-activity-list">
          {events.map((event) => {
            const { label, detail, tone } = describeEvent(event);
            return (
              <li key={event.id} className="security-activity-item">
                <span className={`pill ${tone === "warning" ? "pill-flagged" : tone === "positive" ? "pill-verified" : "pill-category"}`}>
                  {label}
                </span>
                {detail && <span className="security-activity-detail">{detail}</span>}
                <time className="security-activity-time">
                  {event.timestamp?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
