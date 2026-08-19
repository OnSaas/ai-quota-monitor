import { Progress } from "@base-ui/react/progress";
import type { Provider, Snapshot, SummaryResponse, UsageWindow, WindowKey } from "../../shared/types";

const LABELS: Record<Provider, string> = {
  claude: "Claude",
  codex: "Codex",
  copilot: "GitHub Copilot",
  "grok-build": "Grok Build",
};

const WINDOW_LABEL: Record<WindowKey, string> = {
  "5h": "5 小时",
  "7d": "7 天",
  monthly: "月度",
};

function formatAgo(ts?: number): string {
  if (!ts) return "从未更新";
  const delta = Date.now() - ts;
  if (delta < 60_000) return "刚刚";
  if (delta < 3600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86400_000) return `${Math.floor(delta / 3600_000)} 小时前`;
  return new Date(ts).toLocaleString();
}

function formatReset(ts?: number): string {
  if (!ts) return "";
  const left = ts - Date.now();
  if (left <= 0) return "已到重置时间";
  const hours = Math.floor(left / 3600_000);
  if (hours < 48) return `${hours} 小时后重置`;
  return `${Math.floor(hours / 24)} 天后重置`;
}

function freshnessClass(summary: SummaryResponse, snapshot?: Snapshot): string {
  if (!snapshot) return "border-line";
  const ageH = (Date.now() - snapshot.timestamp) / 3600_000;
  if (ageH > summary.config.staleHours * 2) return "border-danger";
  if (ageH > summary.config.staleHours) return "border-warn";
  return "border-line";
}

function WindowBar({ label, window }: { label: string; window: UsageWindow }) {
  const remaining = window.remainingPercent;
  const tone = remaining < 10 ? "bg-danger" : remaining < 25 ? "bg-warn" : "bg-ok";
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>剩余 {remaining.toFixed(1)}%</span>
      </div>
      <Progress.Root value={remaining} className="mt-1 block">
        <Progress.Track className="block h-2 overflow-hidden rounded-full bg-[#0f131a]">
          <Progress.Indicator className={`block h-full ${tone}`} />
        </Progress.Track>
      </Progress.Root>
      {window.resetsAt ? <p className="mt-1 text-xs text-muted">{formatReset(window.resetsAt)}</p> : null}
    </div>
  );
}

function Card({ provider, summary }: { provider: Provider; summary: SummaryResponse }) {
  const snapshot = summary.snapshots[provider];
  return (
    <article className={`rounded-2xl border bg-panel p-5 ${freshnessClass(summary, snapshot)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{LABELS[provider]}</h2>
          <p className="text-xs text-muted">{snapshot?.plan || "无快照"}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            snapshot?.status === "ok"
              ? "bg-ok/15 text-ok"
              : snapshot?.status === "partial"
                ? "bg-warn/15 text-warn"
                : "bg-danger/15 text-danger"
          }`}
        >
          {snapshot?.status ?? "empty"}
        </span>
      </div>
      {snapshot?.windows["monthly"] ? (
        <WindowBar label={WINDOW_LABEL.monthly} window={snapshot.windows.monthly} />
      ) : null}
      {snapshot?.windows["5h"] ? <WindowBar label={WINDOW_LABEL["5h"]} window={snapshot.windows["5h"]} /> : null}
      {snapshot?.windows["7d"] ? <WindowBar label={WINDOW_LABEL["7d"]} window={snapshot.windows["7d"]} /> : null}
      {snapshot?.tokens ? (
        <p className="mt-3 text-sm text-muted">
          tokens {snapshot.tokens.total?.toLocaleString() ?? "—"}（in {snapshot.tokens.input ?? 0} / out{" "}
          {snapshot.tokens.output ?? 0}）
        </p>
      ) : null}
      {snapshot?.error ? <p className="mt-3 text-sm text-warn">{snapshot.error}</p> : null}
      {!snapshot ? <p className="mt-4 text-sm text-muted">还没有推送数据。配置 Actions Secret 后等待下一次同步。</p> : null}
      <p className="mt-4 text-xs text-muted">
        最后更新 {formatAgo(snapshot?.timestamp)} · 来源 {snapshot?.source ?? "—"}
      </p>
    </article>
  );
}

export function Dashboard({
  summary,
  onRefresh,
  busy,
}: {
  summary: SummaryResponse;
  onRefresh: () => void;
  busy: boolean;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">额度总览</h1>
          <p className="text-sm text-muted">数据来源：GitHub Actions。刷新只读 Worker，不会触发采集。</p>
        </div>
        <button type="button" className="aqm-btn aqm-btn-ghost" onClick={onRefresh} disabled={busy}>
          {busy ? "刷新中…" : "刷新"}
        </button>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(["copilot", "grok-build", "claude", "codex"] as Provider[]).map((provider) => (
          <Card key={provider} provider={provider} summary={summary} />
        ))}
      </div>
    </section>
  );
}
