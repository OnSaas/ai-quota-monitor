import type { Snapshot } from "../src/shared/types";

export async function collectClaudeSubscription(): Promise<Snapshot> {
  return {
    provider: "claude",
    source: "actions",
    timestamp: Date.now(),
    plan: "Claude.ai / Claude Code 5h+7d",
    windows: {},
    status: "error",
    error:
      "Claude subscription windows (5h/7d) have no stable official headless API. This collector is a placeholder. Use ANTHROPIC_ADMIN_KEY for official API usage instead.",
  };
}
