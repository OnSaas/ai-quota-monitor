import { Button } from "@base-ui/react/button";
import { useEffect, useState } from "react";
import type { AppConfig, Provider, WebhookKind } from "../../shared/types";
import { api } from "../lib/api";

const PROVIDERS: Provider[] = ["copilot", "grok-build", "claude", "codex"];
const KINDS: WebhookKind[] = ["generic", "discord", "ntfy", "telegram"];

export function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const next = await api<AppConfig>("/v1/config");
    setConfig(next);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, []);

  async function save() {
    if (!config) return;
    setBusy(true);
    setMessage("");
    try {
      const saved = await api<AppConfig>("/v1/config", { method: "PUT", body: JSON.stringify(config) });
      setConfig(saved);
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

  if (!config) return <p className="text-muted">{message || "加载设置…"}</p>;

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold">设置</h1>
      <p className="mt-1 text-sm text-muted">阈值按剩余百分比判断。冷却时间内同一 provider 不会重复通知。</p>

      <div className="mt-6 rounded-2xl border border-line bg-panel p-5">
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
        <Button className="aqm-btn aqm-btn-primary" disabled={busy} onClick={save}>
          保存
        </Button>
        <Button className="aqm-btn aqm-btn-ghost" disabled={busy} onClick={testNotify}>
          测试通知
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
