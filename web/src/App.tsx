// LOCAL — ships in the frontend bundle.
import { useState } from "react";
import AuthGate from "./components/AuthGate";
import JournalEntryForm from "./components/JournalEntryForm";
import JournalList from "./components/JournalList";
import IntegrityBadge from "./components/IntegrityBadge";
import SecurityActivity from "./components/SecurityActivity";
import DeleteDataModal from "./components/DeleteDataModal";

export default function App() {
  const [showSecurityLog, setShowSecurityLog] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

        {showSecurityLog && <SecurityActivity onClose={() => setShowSecurityLog(false)} />}

        <JournalEntryForm />
        <JournalList />

        {showDeleteModal && (
          <DeleteDataModal onClose={() => setShowDeleteModal(false)} onDeleted={handleDataDeleted} />
        )}
      </main>
    </AuthGate>
  );
}
