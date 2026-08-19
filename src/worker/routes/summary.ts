import { PROVIDERS, type Snapshot, type SummaryResponse } from "../../shared/types";
import type { AppEnv } from "../auth";
import { getConfig, getLastPush, getSnapshot } from "../kv";

export async function handleSummary(env: AppEnv): Promise<Response> {
  const snapshots: SummaryResponse["snapshots"] = {};
  for (const provider of PROVIDERS) {
    const snap = await getSnapshot(env, provider);
    if (snap) snapshots[provider] = snap as Snapshot;
  }
  const config = await getConfig(env);
  const payload: SummaryResponse = {
    snapshots,
    lastPush: await getLastPush(env),
    config: { staleHours: config.staleHours },
    generatedAt: Date.now(),
  };
  return Response.json(payload);
}
