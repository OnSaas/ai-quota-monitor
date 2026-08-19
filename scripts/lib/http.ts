import type { Snapshot } from "../../src/shared/types";

export async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { ok: res.ok, status: res.status, json, text };
}

export function authExpired(status: number): boolean {
  return status === 401 || status === 403;
}

export function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}
