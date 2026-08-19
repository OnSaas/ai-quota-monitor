import { nextMonthResetUtc, usedFromCounts, type Snapshot } from "../src/shared/types";
import { authExpired, env, fetchJson } from "./lib/http";

const API_VERSION = "2026-03-10";

interface UsageItem {
  product?: string;
  sku?: string;
  unitType?: string;
  netQuantity?: number;
  grossQuantity?: number;
}

interface UsageReport {
  usageItems?: UsageItem[];
  timePeriod?: { year?: number; month?: number };
}

function sumQuantity(items: UsageItem[], pred: (item: UsageItem) => boolean): number {
  return items.filter(pred).reduce((acc, item) => acc + (item.netQuantity ?? item.grossQuantity ?? 0), 0);
}

function headers(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "ai-quota-monitor",
  };
}

export async function collectCopilot(): Promise<Snapshot> {
  const token = env("COPILOT_TOKEN");
  const now = Date.now();
  if (!token) {
    return {
      provider: "copilot",
      source: "actions",
      timestamp: now,
      windows: {},
      status: "error",
      error: "COPILOT_TOKEN missing",
    };
  }

  const username =
    env("COPILOT_USERNAME") ??
    (await (async () => {
      const me = await fetchJson("https://api.github.com/user", { headers: headers(token) });
      if (!me.ok || !me.json || typeof me.json !== "object") return undefined;
      const login = (me.json as { login?: string }).login;
      return login;
    })());

  if (!username) {
    return {
      provider: "copilot",
      source: "actions",
      timestamp: now,
      windows: {},
      status: "auth_expired",
      error: "cannot resolve GitHub username (token invalid or missing user scope)",
    };
  }

  const org = env("COPILOT_ORG");
  const premiumUrl = org
    ? `https://api.github.com/organizations/${org}/settings/billing/premium_request/usage`
    : `https://api.github.com/users/${username}/settings/billing/premium_request/usage`;
  const creditsUrl = org
    ? `https://api.github.com/organizations/${org}/settings/billing/ai_credit/usage`
    : `https://api.github.com/users/${username}/settings/billing/ai_credit/usage`;

  const [premium, credits] = await Promise.all([
    fetchJson(premiumUrl, { headers: headers(token) }),
    fetchJson(creditsUrl, { headers: headers(token) }),
  ]);

  if (authExpired(premium.status) && authExpired(credits.status)) {
    return {
      provider: "copilot",
      source: "actions",
      timestamp: now,
      windows: {},
      status: "auth_expired",
      error: `GitHub billing API ${premium.status}/${credits.status}. Need Plan:read (user) or Administration:read (org).`,
    };
  }

  const premiumItems = ((premium.json as UsageReport | null)?.usageItems ?? []) as UsageItem[];
  const creditItems = ((credits.json as UsageReport | null)?.usageItems ?? []) as UsageItem[];

  const premiumUsed = sumQuantity(
    premiumItems,
    (item) =>
      (item.product ?? "").toLowerCase().includes("copilot") ||
      (item.sku ?? "").toLowerCase().includes("premium"),
  );
  const creditUsed = sumQuantity(
    creditItems,
    (item) =>
      (item.product ?? "").toLowerCase().includes("copilot") ||
      (item.sku ?? "").toLowerCase().includes("credit") ||
      (item.unitType ?? "").toLowerCase().includes("credit"),
  );

  const allowance = Number(env("COPILOT_MONTHLY_ALLOWANCE") ?? "300");
  const snapshot: Snapshot = {
    provider: "copilot",
    source: "actions",
    timestamp: now,
    plan: org ? `org:${org}` : `user:${username}`,
    windows: {},
    status: "ok",
  };

  if (creditUsed > 0 || (credits.ok && creditItems.length >= 0 && !premium.ok)) {
    const window = usedFromCounts(creditUsed, allowance);
    window.resetsAt = nextMonthResetUtc(now);
    snapshot.windows.monthly = window;
    snapshot.credits = { used: creditUsed, total: allowance };
    snapshot.plan = `${snapshot.plan} · AI credits`;
  } else if (premium.ok || premiumUsed > 0) {
    const window = usedFromCounts(premiumUsed, allowance);
    window.resetsAt = nextMonthResetUtc(now);
    snapshot.windows.monthly = window;
    snapshot.credits = { used: premiumUsed, total: allowance };
    snapshot.plan = `${snapshot.plan} · premium requests`;
  } else {
    snapshot.status = "partial";
    snapshot.error = `billing endpoints returned no Copilot items (premium ${premium.status}, credits ${credits.status})`;
  }

  if (!premium.ok && !credits.ok) {
    snapshot.status = "error";
    snapshot.error = `premium ${premium.status}, credits ${credits.status}`;
  }

  return snapshot;
}
