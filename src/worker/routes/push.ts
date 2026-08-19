import { PROVIDERS, type Provider, type Snapshot } from "../../shared/types";
import type { AppEnv } from "../auth";
import { putSnapshot, touchLastPush } from "../kv";

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

export async function handlePush(request: Request, env: AppEnv): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : [body];
  const stored: Provider[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      return Response.json({ error: "each snapshot must be an object" }, { status: 400 });
    }
    const snap = item as Partial<Snapshot>;
    if (!isProvider(snap.provider)) {
      return Response.json({ error: "invalid provider" }, { status: 400 });
    }
    if (snap.source !== "actions") {
      return Response.json({ error: "source must be actions" }, { status: 400 });
    }
    if (typeof snap.timestamp !== "number" || !Number.isFinite(snap.timestamp)) {
      return Response.json({ error: "timestamp must be unix ms" }, { status: 400 });
    }
    if (snap.status !== "ok" && snap.status !== "partial" && snap.status !== "error" && snap.status !== "auth_expired") {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }

    const snapshot: Snapshot = {
      provider: snap.provider,
      source: "actions",
      timestamp: snap.timestamp,
      plan: typeof snap.plan === "string" ? snap.plan : undefined,
      windows: snap.windows && typeof snap.windows === "object" ? snap.windows : {},
      tokens: snap.tokens,
      credits: snap.credits,
      status: snap.status,
      error: typeof snap.error === "string" ? snap.error : undefined,
    };

    await putSnapshot(env, snapshot);
    if (snapshot.status === "ok" || snapshot.status === "partial") {
      await touchLastPush(env, snapshot.provider, snapshot.timestamp);
    }
    stored.push(snapshot.provider);
  }

  console.log(JSON.stringify({ message: "push accepted", stored }));
  return Response.json({ ok: true, stored });
}
