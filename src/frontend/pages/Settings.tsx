import { Button } from "@base-ui/react/button";
import { useEffect, useState } from "react";
import type { AccountPublic } from "../../shared/accounts";
import type { AppConfig, Provider, WebhookKind } from "../../shared/types";
import { api } from "../lib/api";

const PROVIDERS: Provider[] = ["copilot", "grok-build", "claude", "codex"];
const KINDS: WebhookKind[] = ["generic", "discord", "ntfy", "telegram"];
const LABELS: Record<Provider, string> = {
  copilot: "GitHub Copilot",
  "grok-build": "Grok / xAI",
  claude: "Claude",
  codex: "Codex",
};

export function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [githubOauthReady, setGithubOauthReady] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<Provider, string>>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadConfig() {
    setConfig(await api<AppConfig>("/v1/config"));
  }

  async function loadAccounts() {
    const next = await api<{ accounts: AccountPublic[]; githubOauthReady: boolean }>("/v1/accounts");
    setAccounts(next.accounts);
    setGithubOauthReady(next.githubOauthReady);
  }

  useEffect(() => {
    Promise.all([loadConfig(), loadAccounts()]).catch((error) =>
      setMessage(error instanceof Error ? error.message : String(error)),
    );
  }, []);

  async function save() {
    if (!config) return;
    setBusy(true);
    setMessage("");
    try {
      setConfig(await api<AppConfig>("/v1/config", { method: "PUT", body: JSON.stringify(config) }));
      setMessage("已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function testNotify() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ ok: boolean; skipped?: boolean; status?: number }>("/v1/notify-test", {
        method: "POST",
      });
      setMessage(result.skipped ? "未配置 webhook" : `测试通知已发送（${result.status ?? "ok"}）`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveToken(provider: Provider) {
    const token = drafts[provider]?.trim();
    if (!token) {
      setMessage("先粘贴 token / key");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const next = await api<{ accounts: AccountPublic[]; githubOauthReady: boolean }>("/v1/accounts", {
        method: "PUT",
        body: JSON.stringify({ provider, token, kind: "pat" }),
      });
      setAccounts(next.accounts);
      setDrafts((cur) => ({ ...cur, [provider]: "" }));
      setMessage(`${LABELS[provider]} 已保存到 KV`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(provider: Provider) {
    setBusy(true);
    setMessage("");
    try {
      const next = await api<{ accounts: AccountPublic[]; githubOauthReady: boolean }>(
        `/v1/accounts/${provider}`,
        { method: "DELETE" },
      );
      setAccounts(next.accounts);
      setMessage(`${LABELS[provider]} 已断开`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function registerGithubApp() {
    setBusy(true);
    setMessage("");
    try {
      const next = await api<{ action: string; state: string; manifest: unknown }>("/v1/oauth/github/manifest", {
        method: "POST",
      });
      const form = document.createElement("form");
      form.method = "POST";
      form.action = `${next.action}?state=${encodeURIComponent(next.state)}`;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "manifest";
      input.value = JSON.stringify(next.manifest);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  async function connectGithub() {
    setBusy(true);
    setMessage("");
    try {
      const next = await api<{ url: string }>("/v1/oauth/github/start", { method: "POST" });
      window.location.href = next.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  if (!config) return <p className="text-muted">{message || "加载设置…"}</p>;

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold">设置</h1>
      <p className="mt-1 text-sm text-muted">账号凭证加密后写入 Worker KV。前端只显示是否已连接，不回传 token。</p>

      <div className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-medium">AI 账号</h2>
        <p className="mt-1 text-sm text-muted">
          GitHub 可 OAuth。Grok / Claude 把 key 贴进去保存即可。Codex 仍无稳定官方接口。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="aqm-btn aqm-btn-ghost" disabled={busy} onClick={() => void registerGithubApp()}>
            注册 GitHub App
          </Button>
          <Button className="aqm-btn aqm-btn-primary" disabled={busy || !githubOauthReady} onClick={() => void connectGithub()}>
            GitHub OAuth 登录
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {githubOauthReady ? "GitHub App 已就绪，可点 OAuth。" : "先注册一次 GitHub App（跳转 GitHub 确认），再 OAuth。"}
        </p>

        <div className="mt-4 grid gap-4">
          {PROVIDERS.map((provider) => {
            const account = accounts.find((item) => item.provider === provider);
            return (
              <div key={provider} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{LABELS[provider]}</p>
                    <p className="text-xs text-muted">
                      {account?.connected
                        ? `已连接 · ${account.kind ?? "saved"} · ${account.label ?? ""}`
                        : "未连接"}
                    </p>
                  </div>
                  {account?.connected ? (
                    <Button className="aqm-btn aqm-btn-ghost" disabled={busy} onClick={() => void disconnect(provider)}>
                      断开
                    </Button>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    className="aqm-input"
                    type="password"
                    placeholder="粘贴 token / API key，保存到 KV"
                    value={drafts[provider] ?? ""}
                    onChange={(e) => setDrafts((cur) => ({ ...cur, [provider]: e.target.value }))}
                  />
                  <Button className="aqm-btn aqm-btn-ghost" disabled={busy} onClick={() => void saveToken(provider)}>
                    保存
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-medium">通知阈值（剩余 %）</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((provider) => (
            <label key={provider} className="text-sm text-muted">
              {provider}
              <input
                className="aqm-input mt-1"
                type="number"
                min={0}
                max={100}
                value={config.thresholds[provider]}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    thresholds: { ...config.thresholds, [provider]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-medium">Webhook</h2>
        <label className="mt-3 block text-sm text-muted">
          类型
          <select
            className="aqm-input mt-1"
            value={config.webhookKind}
            onChange={(e) => setConfig({ ...config, webhookKind: e.target.value as WebhookKind })}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm text-muted">
          URL
          <input
            className="aqm-input mt-1"
            value={config.webhookUrl}
            onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
            placeholder="https://…"
          />
        </label>
        <label className="mt-3 block text-sm text-muted">
          Telegram chat id（仅 telegram）
          <input
            className="aqm-input mt-1"
            value={config.telegramChatId ?? ""}
            onChange={(e) => setConfig({ ...config, telegramChatId: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">
          冷却（分钟）
          <input
            className="aqm-input mt-1"
            type="number"
            min={0}
            value={config.cooldownMinutes}
            onChange={(e) => setConfig({ ...config, cooldownMinutes: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm text-muted">
          数据过期（小时）
          <input
            className="aqm-input mt-1"
            type="number"
            min={1}
            value={config.staleHours}
            onChange={(e) => setConfig({ ...config, staleHours: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button className="aqm-btn aqm-btn-primary" disabled={busy} onClick={() => void save()}>
          保存
        </Button>
        <Button className="aqm-btn aqm-btn-ghost" disabled={busy} onClick={() => void testNotify()}>
          测试通知
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
