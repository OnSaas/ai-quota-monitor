import type { AppEnv } from "../auth";
import { getGithubApp, putAccount, putGithubApp, putOauthState, takeOauthState } from "../accounts";

function originOf(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleGithubManifestStart(request: Request, env: AppEnv): Promise<Response> {
  const origin = originOf(request);
  const state = randomId();
  await putOauthState(env, state, { provider: "copilot", createdAt: Date.now() });
  const manifest = {
    name: "AQM",
    url: origin,
    redirect_url: `${origin}/v1/oauth/github/setup`,
    callback_urls: [`${origin}/v1/oauth/github/callback`],
    public: false,
    default_permissions: { plan: "read" },
  };
  return Response.json({
    action: "https://github.com/settings/apps/new",
    state,
    manifest,
  });
}

export async function handleGithubSetup(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(`${originOf(request)}/?oauth=missing_code`, 302);
  const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", "User-Agent": "ai-quota-monitor" },
  });
  if (!res.ok) return Response.redirect(`${originOf(request)}/?oauth=manifest_failed`, 302);
  const data = (await res.json()) as { client_id?: string; client_secret?: string };
  if (!data.client_id || !data.client_secret) {
    return Response.redirect(`${originOf(request)}/?oauth=manifest_failed`, 302);
  }
  await putGithubApp(env, { clientId: data.client_id, clientSecret: data.client_secret });
  return Response.redirect(`${originOf(request)}/?connected=github-app`, 302);
}

export async function handleGithubStart(request: Request, env: AppEnv): Promise<Response> {
  const app = await getGithubApp(env);
  if (!app) return Response.json({ error: "GitHub App 未注册。先点「注册 GitHub App」。" }, { status: 400 });
  const state = randomId();
  await putOauthState(env, state, { provider: "copilot", createdAt: Date.now() });
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", app.clientId);
  authorize.searchParams.set("redirect_uri", `${originOf(request)}/v1/oauth/github/callback`);
  authorize.searchParams.set("state", state);
  return Response.json({ url: authorize.toString() });
}

export async function handleGithubCallback(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const origin = originOf(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return Response.redirect(`${origin}/?oauth=missing_state`, 302);
  const saved = await takeOauthState(env, state);
  if (!saved) return Response.redirect(`${origin}/?oauth=state_expired`, 302);
  const app = await getGithubApp(env);
  if (!app) return Response.redirect(`${origin}/?oauth=no_app`, 302);

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code,
      redirect_uri: `${origin}/v1/oauth/github/callback`,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) return Response.redirect(`${origin}/?oauth=token_failed`, 302);

  const now = Date.now();
  await putAccount(env, {
    provider: "copilot",
    kind: "oauth",
    accessToken: tokenJson.access_token,
    label: "GitHub OAuth",
    createdAt: now,
    updatedAt: now,
  });
  return Response.redirect(`${origin}/?connected=copilot`, 302);
}
