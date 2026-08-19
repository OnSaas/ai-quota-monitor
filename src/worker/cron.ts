import { PROVIDERS, type Provider, type Snapshot } from "../shared/types";
import type { AppEnv } from "./auth";
import { getConfig, getLastNotify, getLastPush, getSnapshot, putLastNotify } from "./kv";
import { sendWebhook, staleMessage, thresholdMessage } from "./notify";

function lowestRemaining(snapshot: Snapshot): number | null {
  const values = Object.values(snapshot.windows)
    .map((w) => w?.remainingPercent)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (values.length === 0) return null;
  return Math.min(...values);
}

function cooledDown(last: number | null, cooldownMinutes: number, now: number): boolean {
  if (!last) return true;
  return now - last >= cooldownMinutes * 60_000;
}

export async function runCron(env: AppEnv): Promise<void> {
  const config = await getConfig(env);
  const lastPush = await getLastPush(env);
  const now = Date.now();
  const staleMs = config.staleHours * 3_600_000;

  for (const provider of PROVIDERS) {
    const last = await getLastNotify(env, provider);
    if (!cooledDown(last, config.cooldownMinutes, now)) continue;

    const snapshot = await getSnapshot(env, provider);
    const pushedAt = lastPush[provider] ?? snapshot?.timestamp ?? 0;

    if (pushedAt && now - pushedAt > staleMs) {
      const sent = await sendWebhook(config, staleMessage(provider, pushedAt, config.staleHours));
      if (sent.ok) await putLastNotify(env, provider, now);
      continue;
    }

    if (!snapshot || snapshot.status === "error") {
      if (snapshot?.status === "auth_expired") {
        const sent = await sendWebhook(config, {
          title: `AQM · ${provider} auth expired`,
          body: snapshot.error || "Collector reported auth_expired. Update the GitHub Actions secret.",
          provider,
          kind: "auth",
        });
        if (sent.ok) await putLastNotify(env, provider, now);
      }
      continue;
    }

    const remaining = lowestRemaining(snapshot);
    const threshold = config.thresholds[provider as Provider];
    if (remaining === null || threshold === undefined) continue;
    if (remaining > threshold) continue;

    const sent = await sendWebhook(config, thresholdMessage(snapshot, remaining, threshold));
    if (sent.ok) await putLastNotify(env, provider, now);
  }
}
