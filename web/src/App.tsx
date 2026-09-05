// LOCAL — ships in the frontend bundle.
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import AuthGate from "./components/AuthGate";
import JournalEntryForm from "./components/JournalEntryForm";
import JournalList from "./components/JournalList";
import IntegrityBadge from "./components/IntegrityBadge";
import SecurityActivity from "./components/SecurityActivity";
import DeleteDataModal from "./components/DeleteDataModal";
import JournalModeToggle from "./components/JournalModeToggle";
import { auth } from "./firebase";
import { getJournalPreferences, JournalMode, updateJournalMode } from "./lib/api";

export default function App() {
  const [showSecurityLog, setShowSecurityLog] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [journalMode, setJournalMode] = useState<JournalMode>("ai");
  const [modeReady, setModeReady] = useState(false);
  const [modeError, setModeError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let preferenceRequest = 0;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        preferenceRequest += 1;
        setJournalMode("ai");
        setModeReady(false);
        setModeError("");
        return;
      }

      setModeReady(false);
      setModeError("");
      const requestId = ++preferenceRequest;
      void getJournalPreferences()
        .then((preferences) => {
          if (!cancelled && requestId === preferenceRequest) {
            setJournalMode(preferences.journalMode === "private" ? "private" : "ai");
            setModeReady(true);
          }
        })
        .catch((err) => {
          if (!cancelled && requestId === preferenceRequest) {
            setModeError(err instanceof Error ? err.message : "Couldn't load journal mode.");
            setModeReady(false);
          }
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function handleJournalModeChange(nextMode: JournalMode) {
    const saved = await updateJournalMode(nextMode);
    setJournalMode(saved.journalMode === "private" ? "private" : "ai");
    setModeError("");
  }

  function handleDataDeleted() {
    setRefreshKey((prev) => prev + 1);
  }

  return (
    <AuthGate
      onToggleSecurityLog={() => setShowSecurityLog((prev) => !prev)}
      onOpenDeleteModal={() => setShowDeleteModal(true)}
      securityLogOpen={showSecurityLog}
    >
      <main className="app-main" key={refreshKey}>
        <div className="security-toolbar">
          <IntegrityBadge />
        </div>

        <JournalModeToggle
          mode={journalMode}
          ready={modeReady}
          error={modeError}
          onChange={handleJournalModeChange}
        />

        {showSecurityLog && <SecurityActivity onClose={() => setShowSecurityLog(false)} />}

        <JournalEntryForm journalMode={journalMode} disabled={!modeReady} />
        <JournalList />

        {showDeleteModal && (
          <DeleteDataModal onClose={() => setShowDeleteModal(false)} onDeleted={handleDataDeleted} />
        )}
      </main>
    </AuthGate>
  );
}
