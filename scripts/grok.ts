import { remainingPercent, type Snapshot } from "../src/shared/types";
import { authExpired, env, fetchJson } from "./lib/http";

interface ApiKeyInfo {
  name?: string;
  team_id?: string;
  limit_amount_usd?: number;
  remaining_amount_usd?: number;
  api_key_blocked?: boolean;
  team_blocked?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

export async function collectGrok(): Promise<Snapshot> {
  const token = env("GROK_TOKEN");
  const now = Date.now();
  if (!token) {
    return {
      provider: "grok-build",
      source: "actions",
      timestamp: now,
      windows: {},
      status: "error",
      error: "GROK_TOKEN missing",
    };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": "ai-quota-monitor",
  };

  const keyInfo = await fetchJson("https://api.x.ai/v1/api-key", { headers });
  if (authExpired(keyInfo.status)) {
    return {
      provider: "grok-build",
      source: "actions",
      timestamp: now,
      windows: {},
      status: "auth_expired",
      error: "xAI api-key endpoint rejected token. Update GROK_TOKEN secret.",
    };
  }

  if (keyInfo.ok) {
    const info = (keyInfo.json ?? {}) as ApiKeyInfo;
    const remaining = info.remaining_amount_usd;
    const limit = info.limit_amount_usd;
    if (typeof remaining === "number" && typeof limit === "number" && limit > 0) {
      const usedPercent = Math.max(0, Math.min(100, ((limit - remaining) / limit) * 100));
      return {
        provider: "grok-build",
        source: "actions",
        timestamp: now,
        plan: info.name || "xAI API key",
        windows: {
          monthly: { usedPercent, remainingPercent: remainingPercent(usedPercent) },
        },
        credits: { used: Math.max(0, limit - remaining), total: limit },
        status: info.api_key_blocked || info.team_blocked ? "partial" : "ok",
        error: info.api_key_blocked || info.team_blocked ? "key or team is blocked" : undefined,
      };
    }
  }

  const usageCandidates = [
    "https://api.x.ai/v1/usage",
    "https://api.x.ai/v1/billing/usage",
  ];

  for (const url of usageCandidates) {
    const usage = await fetchJson(url, { headers });
    if (!usage.ok) continue;
    const rec = asRecord(usage.json);
    if (!rec) continue;
    const used = pickNumber(rec, ["used_percent", "usedPercent", "percent_used"]);
    const remaining = pickNumber(rec, ["remaining_percent", "remainingPercent", "percent_remaining"]);
    if (typeof used === "number" || typeof remaining === "number") {
      const usedPercent = typeof used === "number" ? used : 100 - (remaining ?? 0);
      return {
        provider: "grok-build",
        source: "actions",
        timestamp: now,
        plan: "xAI usage",
        windows: {
          monthly: { usedPercent, remainingPercent: remainingPercent(usedPercent) },
        },
        status: "ok",
      };
    }
  }

  return {
    provider: "grok-build",
    source: "actions",
    timestamp: now,
    windows: {},
    status: keyInfo.ok ? "partial" : "error",
    error: keyInfo.ok
      ? "token valid but no spend cap / usage percent on official api-key payload. SuperGrok 5h/7d windows have no stable public API."
      : `xAI api-key ${keyInfo.status}`,
  };
}
