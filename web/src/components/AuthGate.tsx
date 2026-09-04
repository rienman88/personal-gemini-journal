/**
 * LOCAL — ships in the frontend bundle.
 *
 * Federated sign-in only (Google), not email/password.
 */
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { auth, authPersistenceReady } from "../firebase";

const provider = new GoogleAuthProvider();

interface AuthGateProps {
  children: React.ReactNode;
  onToggleSecurityLog?: () => void;
  onOpenDeleteModal?: () => void;
  securityLogOpen?: boolean;
}

export default function AuthGate({ children, onToggleSecurityLog, onOpenDeleteModal, securityLogOpen }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    []
  );

  async function handleSignIn() {
    setError("");
    try {
      await authPersistenceReady;
      try {
        await signInWithPopup(auth, provider);
      } catch {
        await signInWithRedirect(auth, provider);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
    }
  }

  if (loading) return <div className="centered-message">Loading…</div>;

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1 className="auth-title">Personal Journal</h1>
          <p className="auth-sub">A private space, guarded before it ever reaches a model.</p>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button onClick={handleSignIn}>Sign in with Google</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-header-title">Personal Journal</span>
          {user.email && <span className="user-email-chip">{user.email}</span>}
        </div>
        <div className="app-header-actions">
          {onToggleSecurityLog && (
            <button className={`header-action-btn ${securityLogOpen ? "active" : ""}`} onClick={onToggleSecurityLog}>
              🛡️ Security Activity
            </button>
          )}
          {onOpenDeleteModal && (
            <button className="header-action-btn secondary-action" onClick={onOpenDeleteModal} title="Delete All Journal Data">
              🗑️ Delete Data
            </button>
          )}
          <button className="link-button" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
