export const PROVIDERS = ["claude", "codex", "copilot", "grok-build"] as const;

export type Provider = (typeof PROVIDERS)[number];

export type SnapshotStatus = "ok" | "partial" | "error" | "auth_expired";

export type WindowKey = "5h" | "7d" | "monthly";

export interface UsageWindow {
  usedPercent: number;
  remainingPercent: number;
  resetsAt?: number;
}

export interface Snapshot {
  provider: Provider;
  source: "actions";
  timestamp: number;
  plan?: string;
  windows: Partial<Record<WindowKey, UsageWindow>>;
  tokens?: { input?: number; output?: number; total?: number };
  credits?: { used?: number; total?: number };
  status: SnapshotStatus;
  error?: string;
  raw?: unknown;
}

export interface LastPushMap {
  [provider: string]: number;
}

export type WebhookKind = "generic" | "discord" | "ntfy" | "telegram";

export interface AppConfig {
  thresholds: Partial<Record<Provider, number>>;
  webhookUrl: string;
  webhookKind: WebhookKind;
  /** Telegram bot token when webhookKind is telegram (chat id lives in webhookUrl as chat_id query or as telegramChatId). */
  telegramChatId?: string;
  cooldownMinutes: number;
  staleHours: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  thresholds: {
    claude: 20,
    codex: 20,
    copilot: 20,
    "grok-build": 20,
  },
  webhookUrl: "",
  webhookKind: "generic",
  cooldownMinutes: 360,
  staleHours: 3,
};

export interface SummaryResponse {
  snapshots: Partial<Record<Provider, Snapshot>>;
  lastPush: LastPushMap;
  config: Pick<AppConfig, "staleHours">;
  generatedAt: number;
}

export function remainingPercent(usedPercent: number): number {
  if (!Number.isFinite(usedPercent)) return 0;
  return Math.max(0, Math.min(100, 100 - usedPercent));
}

export function usedFromCounts(used: number, total: number): UsageWindow {
  const safeTotal = total > 0 ? total : 0;
  const usedPercent = safeTotal === 0 ? 0 : Math.max(0, Math.min(100, (used / safeTotal) * 100));
  return {
    usedPercent,
    remainingPercent: remainingPercent(usedPercent),
  };
}

export function nextMonthResetUtc(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0);
}
