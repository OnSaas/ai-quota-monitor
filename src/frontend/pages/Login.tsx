import { Button } from "@base-ui/react/button";
import { useState, type FormEvent } from "react";
import { api, setToken } from "../lib/api";

export function Login({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setToken(password.trim());
    try {
      await api("/v1/summary");
      onAuthed();
    } catch {
      setError("密码不对");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-xl"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-muted">AQM</p>
        <h1 className="mt-2 text-2xl font-semibold">AI Quota Monitor</h1>
        <p className="mt-2 text-sm text-muted">输入管理员密码。密码由 Worker 机密变量 ADMIN_TOKEN 控制。</p>
        <label className="mt-5 block text-sm text-muted" htmlFor="password">
          管理员密码
        </label>
        <input
          id="password"
          className="aqm-input mt-1"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={busy} className="aqm-btn aqm-btn-primary mt-5 w-full">
          {busy ? "验证中…" : "进入"}
        </Button>
      </form>
    </div>
  );
}
