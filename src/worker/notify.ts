import type { AppConfig, Provider, Snapshot } from "../shared/types";

export interface NotifyPayload {
  title: string;
  body: string;
  provider?: Provider;
  kind: "threshold" | "stale" | "test" | "auth";
}

function jsonBody(payload: NotifyPayload): string {
  return JSON.stringify({
    text: `${payload.title}\n${payload.body}`,
    title: payload.title,
    body: payload.body,
    provider: payload.provider,
    kind: payload.kind,
    timestamp: Date.now(),
  });
}

export async function sendWebhook(config: AppConfig, payload: NotifyPayload): Promise<{ ok: boolean; error?: string }> {
  const url = config.webhookUrl?.trim();
  if (!url) return { ok: false, error: "webhookUrl is empty" };

  try {
    if (config.webhookKind === "discord") {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: `**${payload.title}**\n${payload.body}`,
        }),
      });
      if (!res.ok) return { ok: false, error: `discord ${res.status}` };
      return { ok: true };
    }

    if (config.webhookKind === "ntfy") {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Title: payload.title,
          Tags: payload.kind === "threshold" ? "warning" : "info",
        },
        body: payload.body,
      });
      if (!res.ok) return { ok: false, error: `ntfy ${res.status}` };
      return { ok: true };
    }

    if (config.webhookKind === "telegram") {
      const chatId = config.telegramChatId?.trim();
      let endpoint = url;
      let chat = chatId;
      try {
        const parsed = new URL(url);
        chat = chat || parsed.searchParams.get("chat_id") || "";
      } catch {
        /* keep as-is */
      }
      if (!chat) return { ok: false, error: "telegram chat_id missing" };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text: `${payload.title}\n${payload.body}`,
        }),
      });
      if (!res.ok) return { ok: false, error: `telegram ${res.status}` };
      return { ok: true };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody(payload),
    });
    if (!res.ok) return { ok: false, error: `webhook ${res.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function thresholdMessage(snapshot: Snapshot, remaining: number, threshold: number): NotifyPayload {
  return {
    title: `AQM · ${snapshot.provider} remaining ${remaining.toFixed(1)}%`,
    body: `Remaining quota is below ${threshold}%. Last update: ${new Date(snapshot.timestamp).toISOString()}. Status: ${snapshot.status}.`,
    provider: snapshot.provider,
    kind: "threshold",
  };
}

export function staleMessage(provider: Provider, last: number, staleHours: number): NotifyPayload {
  return {
    title: `AQM · ${provider} data stale`,
    body: `No successful push for ${provider} in ${staleHours}h. Last push: ${last ? new Date(last).toISOString() : "never"}.`,
    provider,
    kind: "stale",
  };
}
