import {
  DEFAULT_CONFIG,
  type AppConfig,
  type LastPushMap,
  type Provider,
  type Snapshot,
} from "../shared/types";
import type { AppEnv } from "./auth";

export const KEY = {
  snapshot: (provider: Provider) => `snapshot:${provider}`,
  lastPush: "meta:last_push",
  config: "config",
  lastNotify: (provider: Provider) => `last_notify:${provider}`,
} as const;

export async function getSnapshot(env: AppEnv, provider: Provider): Promise<Snapshot | null> {
  return env.KV.get<Snapshot>(KEY.snapshot(provider), "json");
}

export async function putSnapshot(env: AppEnv, snapshot: Snapshot): Promise<void> {
  await env.KV.put(KEY.snapshot(providerOf(snapshot)), JSON.stringify(snapshot));
}

function providerOf(snapshot: Snapshot): Provider {
  return snapshot.provider;
}

export async function getLastPush(env: AppEnv): Promise<LastPushMap> {
  return (await env.KV.get<LastPushMap>(KEY.lastPush, "json")) ?? {};
}

export async function touchLastPush(env: AppEnv, provider: Provider, timestamp: number): Promise<void> {
  const current = await getLastPush(env);
  current[provider] = timestamp;
  await env.KV.put(KEY.lastPush, JSON.stringify(current));
}

export async function getConfig(env: AppEnv): Promise<AppConfig> {
  const stored = await env.KV.get<Partial<AppConfig>>(KEY.config, "json");
  if (!stored) return { ...DEFAULT_CONFIG, thresholds: { ...DEFAULT_CONFIG.thresholds } };
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...stored.thresholds },
  };
}

export async function putConfig(env: AppEnv, config: AppConfig): Promise<void> {
  await env.KV.put(KEY.config, JSON.stringify(config));
}

export async function getLastNotify(env: AppEnv, provider: Provider): Promise<number | null> {
  const raw = await env.KV.get(KEY.lastNotify(provider));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function putLastNotify(env: AppEnv, provider: Provider, timestamp: number): Promise<void> {
  await env.KV.put(KEY.lastNotify(provider), String(timestamp));
}
