import { type Snapshot } from "../src/shared/types";
import { authExpired, env, fetchJson } from "./lib/http";

interface UsageBucket {
  starting_at?: string;
  ending_at?: string;
  results?: Array<{
    uncached_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens?: number;
    cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number };
  }>;
}

export async function collectClaude(): Promise<Snapshot> {
  const key = env("ANTHROPIC_ADMIN_KEY");
  const now = Date.now();
  if (!key) {
    return {
      provider: "claude",
      source: "actions",
      timestamp: now,
      windows: {},
      status: "error",
      error: "ANTHROPIC_ADMIN_KEY missing",
    };
  }

  const starting = new Date(now - 30 * 24 * 3600_000).toISOString();
  const url = `https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${encodeURIComponent(starting)}&bucket_width=1d&limit=31`;
  const res = await fetchJson(url, {
    headers: {
      "anthropic-version": "2023-06-01",
      authorization: `Bearer ${key}`,
      "x-api-key": key,
    },
  });

  if (authExpired(res.status)) {
    return {
      provider: "claude",
      source: "actions",
      timestamp: now,
      windows: {},
      status: "auth_expired",
      error: "Anthropic Admin usage API rejected the key. Use an Admin API key / OAuth, not a regular Messages API key.",
    };
  }

  if (!res.ok) {
    return {
      provider: "claude",
      source: "actions",
      timestamp: now,
      windows: {},
      status: "error",
      error: `usage_report ${res.status}`,
    };
  }

  const data = (res.json as { data?: UsageBucket[] } | null)?.data ?? [];
  let input = 0;
  let output = 0;
  for (const bucket of data) {
    for (const row of bucket.results ?? []) {
      input +=
        (row.uncached_input_tokens ?? 0) +
        (row.cache_read_input_tokens ?? 0) +
        (row.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
        (row.cache_creation?.ephemeral_5m_input_tokens ?? 0);
      output += row.output_tokens ?? 0;
    }
  }

  return {
    provider: "claude",
    source: "actions",
    timestamp: now,
    plan: "Claude API usage (Admin)",
    windows: {},
    tokens: { input, output, total: input + output },
    status: "ok",
    error:
      "Official usage report is token counts, not the Claude.ai 5h/7d subscription window. Remaining % is unavailable from this API.",
  };
}
