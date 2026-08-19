import { useCallback, useEffect, useState } from "react";
import type { SummaryResponse } from "../shared/types";
import { api, clearToken, getToken } from "./lib/api";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";

type Page = "dashboard" | "settings";

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const next = await api<SummaryResponse>("/v1/summary");
      setSummary(next);
      setAuthed(true);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401) {
        clearToken();
        setAuthed(false);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") || params.get("oauth")) setPage("settings");
    if (!getToken()) {
      setReady(true);
      setAuthed(false);
      return;
    }
    void load();
  }, [load]);

  if (!ready) return null;
  if (!authed) return <Login onAuthed={() => void load()} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">AQM</p>
            <p className="font-semibold">AI Quota Monitor</p>
          </div>
          <nav className="flex gap-2">
            <button
              type="button"
              className={`aqm-btn ${page === "dashboard" ? "aqm-btn-primary" : "aqm-btn-ghost"}`}
              onClick={() => setPage("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`aqm-btn ${page === "settings" ? "aqm-btn-primary" : "aqm-btn-ghost"}`}
              onClick={() => setPage("settings")}
            >
              Settings
            </button>
            <button
              type="button"
              className="aqm-btn aqm-btn-ghost"
              onClick={() => {
                clearToken();
                setAuthed(false);
              }}
            >
              退出
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
        {page === "dashboard" && summary ? (
          <Dashboard summary={summary} onRefresh={() => void load()} busy={busy} />
        ) : null}
        {page === "settings" ? <Settings /> : null}
      </main>
    </div>
  );
}
