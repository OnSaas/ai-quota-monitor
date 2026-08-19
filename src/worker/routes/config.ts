import { DEFAULT_CONFIG, PROVIDERS, type AppConfig, type Provider, type WebhookKind } from "../../shared/types";
import type { AppEnv } from "../auth";
import { getConfig, putConfig } from "../kv";

const KINDS: WebhookKind[] = ["generic", "discord", "ntfy", "telegram"];

function sanitize(input: Partial<AppConfig>, current: AppConfig): AppConfig {
  const thresholds = { ...current.thresholds };
  if (input.thresholds && typeof input.thresholds === "object") {
    for (const provider of PROVIDERS) {
      const value = input.thresholds[provider as Provider];
      if (typeof value === "number" && Number.isFinite(value)) {
        thresholds[provider] = Math.max(0, Math.min(100, value));
      }
    }
  }

  const kind = KINDS.includes(input.webhookKind as WebhookKind)
    ? (input.webhookKind as WebhookKind)
    : current.webhookKind;

  return {
    thresholds,
    webhookUrl: typeof input.webhookUrl === "string" ? input.webhookUrl.trim() : current.webhookUrl,
    webhookKind: kind,
    telegramChatId:
      typeof input.telegramChatId === "string" ? input.telegramChatId.trim() : current.telegramChatId,
    cooldownMinutes:
      typeof input.cooldownMinutes === "number" && Number.isFinite(input.cooldownMinutes)
        ? Math.max(5, Math.min(24 * 60, Math.round(input.cooldownMinutes)))
        : current.cooldownMinutes,
    staleHours:
      typeof input.staleHours === "number" && Number.isFinite(input.staleHours)
        ? Math.max(1, Math.min(72, Math.round(input.staleHours)))
        : current.staleHours,
  };
}

export async function handleConfigGet(env: AppEnv): Promise<Response> {
  const config = await getConfig(env);
  return Response.json({ ...DEFAULT_CONFIG, ...config });
}

export async function handleConfigPut(request: Request, env: AppEnv): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "body must be an object" }, { status: 400 });
  }
  const current = await getConfig(env);
  const next = sanitize(body as Partial<AppConfig>, current);
  await putConfig(env, next);
  return Response.json(next);
}
