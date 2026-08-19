import { collectClaude } from "./claude";
import { collectCodex } from "./codex";
import { collectCopilot } from "./copilot";
import { collectGrok } from "./grok";
import { env } from "./lib/http";
import { ghSummary, pushSnapshot } from "./lib/push";
import type { Snapshot } from "../src/shared/types";

type Collector = () => Promise<Snapshot>;

const collectors: Array<{ name: string; enabled: boolean; run: Collector }> = [
  { name: "copilot", enabled: Boolean(env("COPILOT_TOKEN")), run: collectCopilot },
  { name: "grok-build", enabled: Boolean(env("GROK_TOKEN")), run: collectGrok },
  { name: "claude", enabled: Boolean(env("ANTHROPIC_ADMIN_KEY")), run: collectClaude },
  { name: "codex", enabled: env("AQM_PUSH_UNSUPPORTED") === "1", run: collectCodex },
];

async function main(): Promise<void> {
  const lines = ["## AQM quota sync", ""];
  let failures = 0;

  for (const collector of collectors) {
    if (!collector.enabled) {
      lines.push(`- ${collector.name}: skipped (secret not set)`);
      continue;
    }
    try {
      const snapshot = await collector.run();
      await pushSnapshot(snapshot);
      const remaining = Object.entries(snapshot.windows)
        .map(([k, w]) => `${k} ${w?.remainingPercent.toFixed(1)}% left`)
        .join(", ");
      lines.push(
        `- ${collector.name}: **${snapshot.status}** ${remaining || snapshot.error || ""}`.trim(),
      );
      if (snapshot.status === "error" || snapshot.status === "auth_expired") failures += 1;
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      lines.push(`- ${collector.name}: **failed** ${message}`);
      try {
        await pushSnapshot({
          provider: collector.name as Snapshot["provider"],
          source: "actions",
          timestamp: Date.now(),
          windows: {},
          status: "error",
          error: message.slice(0, 300),
        });
      } catch (pushError) {
        lines.push(`  - push also failed: ${pushError instanceof Error ? pushError.message : String(pushError)}`);
      }
    }
  }

  ghSummary(lines);
  if (failures > 0) {
    console.error(`completed with ${failures} collector failure(s)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
