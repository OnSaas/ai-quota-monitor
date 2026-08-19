import type { Snapshot } from "../src/shared/types";

export async function collectCodex(): Promise<Snapshot> {
  return {
    provider: "codex",
    source: "actions",
    timestamp: Date.now(),
    plan: "unsupported",
    windows: {},
    status: "error",
    error:
      "Codex / ChatGPT subscription quota has no stable official headless API. Not implemented by design (high risk, easy to break).",
  };
}
