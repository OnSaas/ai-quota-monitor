import type { AccountPublic, AccountRecord, GithubAppCreds, OauthState } from "../shared/accounts";
import type { Provider } from "../shared/types";
import type { AppEnv } from "./auth";
import { decryptJson, encryptJson, wrapSecret } from "./crypto";

const KEY = {
  account: (provider: Provider) => `account:${provider}`,
  githubApp: "oauth_app:github",
  oauthState: (id: string) => `oauth_state:${id}`,
};

export async function getAccount(env: AppEnv, provider: Provider): Promise<AccountRecord | null> {
  const raw = await env.KV.get(KEY.account(provider));
  if (!raw) return null;
  try {
    return await decryptJson<AccountRecord>(wrapSecret(env), raw);
  } catch {
    return null;
  }
}

export async function putAccount(env: AppEnv, record: AccountRecord): Promise<void> {
  await env.KV.put(KEY.account(record.provider), await encryptJson(wrapSecret(env), record));
}

export async function deleteAccount(env: AppEnv, provider: Provider): Promise<void> {
  await env.KV.delete(KEY.account(provider));
}

export async function listAccounts(env: AppEnv): Promise<AccountPublic[]> {
  const providers: Provider[] = ["copilot", "grok-build", "claude", "codex"];
  const out: AccountPublic[] = [];
  for (const provider of providers) {
    const rec = await getAccount(env, provider);
    out.push(
      rec
        ? {
            provider,
            connected: true,
            kind: rec.kind,
            label: rec.label,
            updatedAt: rec.updatedAt,
          }
        : { provider, connected: false },
    );
  }
  return out;
}

export async function getGithubApp(env: AppEnv): Promise<GithubAppCreds | null> {
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    return { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  }
  const raw = await env.KV.get(KEY.githubApp);
  if (!raw) return null;
  try {
    return await decryptJson<GithubAppCreds>(wrapSecret(env), raw);
  } catch {
    return null;
  }
}

export async function putGithubApp(env: AppEnv, creds: GithubAppCreds): Promise<void> {
  await env.KV.put(KEY.githubApp, await encryptJson(wrapSecret(env), creds));
}

export async function putOauthState(env: AppEnv, id: string, state: OauthState): Promise<void> {
  await env.KV.put(KEY.oauthState(id), JSON.stringify(state), { expirationTtl: 600 });
}

export async function takeOauthState(env: AppEnv, id: string): Promise<OauthState | null> {
  const raw = await env.KV.get(KEY.oauthState(id));
  if (!raw) return null;
  await env.KV.delete(KEY.oauthState(id));
  return JSON.parse(raw) as OauthState;
}
