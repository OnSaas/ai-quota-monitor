import { nextMonthResetUtc, remainingPercent, usedFromCounts, type Provider, type Snapshot } from "../shared/types";
import type { AppEnv } from "./auth";
import { getAccount } from "./accounts";

async function fetchJson(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, json };
}

function expired(status: number): boolean {
  return status === 401 || status === 403;
}

async function collectCopilot(token: string): Promise<Snapshot> {
  const now = Date.now();
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "ai-quota-monitor",
  };
  const me = await fetchJson("https://api.github.com/user", { headers });
  const username = me.ok && me.json && typeof me.json === "object" ? (me.json as { login?: string }).login : undefined;
  if (!username) {
    return {
      provider: "copilot",
      source: "worker",
      timestamp: now,
      windows: {},
      status: "auth_expired",
      error: "GitHub token cannot resolve /user",
    };
  }
  const premium = await fetchJson(
    `https://api.github.com/users/${username}/settings/billing/premium_request/usage`,
    { headers },
  );
  const credits = await fetchJson(
    `https://api.github.com/users/${username}/settings/billing/ai_credit/usage`,
    { headers },
  );
  if (expired(premium.status) && expired(credits.status)) {
    return {
      provider: "copilot",
      source: "worker",
      timestamp: now,
      plan: username,
      windows: {},
      status: "auth_expired",
      error: "billing API rejected token (need Plan:read or a PAT)",
    };
  }

  const items = [
    ...(((premium.json as { usageItems?: Array<{ netQuantity?: number; product?: string }> } | null)?.usageItems ?? [])),
    ...(((credits.json as { usageItems?: Array<{ netQuantity?: number; product?: string }> } | null)?.usageItems ?? [])),
  ];
  const used = items.reduce((acc, item) => acc + (item.netQuantity ?? 0), 0);
  const allowance = 300;
  const window = usedFromCounts(used, allowance);
  window.resetsAt = nextMonthResetUtc(now);
  return {
    provider: "copilot",
    source: "worker",
    timestamp: now,
    plan: username,
    windows: { monthly: window },
    status: premium.ok || credits.ok ? "ok" : "partial",
  };
}

async function collectGrok(token: string): Promise<Snapshot> {
  const now = Date.now();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const keyInfo = await fetchJson("https://api.x.ai/v1/api-key", { headers });
  if (expired(keyInfo.status)) {
    return {
      provider: "grok-build",
      source: "worker",
      timestamp: now,
      windows: {},
      status: "auth_expired",
      error: "xAI rejected token",
    };
  }
  const info = (keyInfo.json ?? {}) as { remaining_amount_usd?: number; limit_amount_usd?: number; name?: string };
  if (typeof info.remaining_amount_usd === "number" && typeof info.limit_amount_usd === "number" && info.limit_amount_usd > 0) {
    const usedPercent = Math.max(0, Math.min(100, ((info.limit_amount_usd - info.remaining_amount_usd) / info.limit_amount_usd) * 100));
    return {
      provider: "grok-build",
      source: "worker",
      timestamp: now,
      plan: info.name || "xAI",
      windows: { monthly: { usedPercent, remainingPercent: remainingPercent(usedPercent) } },
      credits: { used: info.limit_amount_usd - info.remaining_amount_usd, total: info.limit_amount_usd },
      status: "ok",
    };
  }
  return {
    provider: "grok-build",
    source: "worker",
    timestamp: now,
    windows: {},
    status: keyInfo.ok ? "partial" : "error",
    error: "token saved but no spend cap on api-key payload",
  };
}

async function collectClaude(key: string): Promise<Snapshot> {
  const now = Date.now();
  const starting = new Date(now - 30 * 24 * 3600_000).toISOString();
  const res = await fetchJson(
    `https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${encodeURIComponent(starting)}&bucket_width=1d&limit=31`,
    {
      headers: {
        "anthropic-version": "2023-06-01",
        authorization: `Bearer ${key}`,
        "x-api-key": key,
      },
    },
  );
  if (expired(res.status)) {
    return {
      provider: "claude",
      source: "worker",
      timestamp: now,
      windows: {},
      status: "auth_expired",
      error: "Anthropic rejected key",
    };
  }
  if (!res.ok) {
    return {
      provider: "claude",
      source: "worker",
      timestamp: now,
      windows: {},
      status: "error",
      error: `usage_report ${res.status}`,
    };
  }
  return {
    provider: "claude",
    source: "worker",
    timestamp: now,
    plan: "Claude API usage",
    windows: {},
    status: "ok",
    error: "Admin usage report is token counts, not 5h/7d windows",
  };
}

export async function collectFromKv(env: AppEnv): Promise<Snapshot[]> {
  const providers: Provider[] = ["copilot", "grok-build", "claude"];
  const out: Snapshot[] = [];
  for (const provider of providers) {
    const account = await getAccount(env, provider);
    if (!account) continue;
    try {
      if (provider === "copilot") out.push(await collectCopilot(account.accessToken));
      else if (provider === "grok-build") out.push(await collectGrok(account.accessToken));
      else out.push(await collectClaude(account.accessToken));
    } catch (error) {
      out.push({
        provider,
        source: "worker",
        timestamp: Date.now(),
        windows: {},
        status: "error",
        error: error instanceof Error ? error.message : "collect failed",
      });
    }
  }
  return out;
}
