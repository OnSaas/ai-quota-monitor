import type { AppEnv } from "../auth";
import { collectFromKv } from "../collect";
import { putSnapshot, touchLastPush } from "../kv";

export async function handleCollect(env: AppEnv): Promise<Response> {
  const snapshots = await collectFromKv(env);
  for (const snapshot of snapshots) {
    await putSnapshot(env, snapshot);
    if (snapshot.status !== "error") await touchLastPush(env, snapshot.provider, snapshot.timestamp);
  }
  return Response.json({ ok: true, count: snapshots.length, snapshots });
}
