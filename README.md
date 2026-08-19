# AI Quota Monitor (AQM)

个人 AI 订阅额度监控：**GitHub Actions 采集 → Cloudflare Worker KV 存储 → Base UI Dashboard 只读**。

零本地常驻进程。单个 Worker（含 Static Assets）。只用 KV，不用 D1 / R2 / Durable Objects。

## 架构

```
GitHub Actions (60min)
  → 各服务独立脚本取用量
  → POST /v1/push 用量 JSON（不含登录 token）
Cloudflare Worker
  → KV 存 snapshot / config / last_notify
  → Cron 检查阈值与过期，发 webhook
  → Static Assets: React + Base UI
```

前端刷新**只打 Worker**，绝不触发 Actions。

## 本地开发

```bash
cp .dev.vars.example .dev.vars   # PUSH_TOKEN / ADMIN_TOKEN
npm install
npm run dev:worker               # wrangler dev，先 npm run build 出 dist
```

另开终端改前端时：

```bash
npm run dev:web
```

生产构建 + 部署：

```bash
npx wrangler login
npx wrangler secret put PUSH_TOKEN
npx wrangler secret put ADMIN_TOKEN
npm run deploy
```

首次 `wrangler deploy` 会自动创建 KV namespace。

## GitHub Actions 部署

`main` 推送和手动 `workflow_dispatch` 会跑 `.github/workflows/deploy-worker.yml`：先 `typecheck` + `vite build`，再 `wrangler deploy`。PR 只跑检查，不部署。目标账号：Cloudflare **EdgeNux**（`ai-quota-monitor.onw.workers.dev`）。

Worker 的 `PUSH_TOKEN` / `ADMIN_TOKEN` 仍用 `wrangler secret put`（或 Dashboard Secrets），不要写进仓库、不要每次部署覆盖。

EdgeNux 当前是 Workers Free，账号 Cron 触发器已满（5/5），因此阈值检查改由 `quota-sync` 在采集后 POST `/v1/cron`。Worker 仍保留 `scheduled` handler，升到 Paid 后可把 cron 加回 `wrangler.jsonc`。

## GitHub Actions Secrets

仓库 Settings → Secrets and variables → Actions：

| Secret | 必须 | 说明 |
|--------|------|------|
| `CLOUDFLARE_API_TOKEN` | 部署必须 | 权限：Account · Workers Scripts Edit、Workers KV Storage Edit |
| `CLOUDFLARE_ACCOUNT_ID` | 部署必须 | EdgeNux：`22788d96116325ff531105e98c23bc95` |
| `WORKER_PUSH_URL` | 采集必须 | `https://ai-quota-monitor.onw.workers.dev/v1/push` |
| `WORKER_BASE_URL` | 采集必须 | `https://ai-quota-monitor.onw.workers.dev` |
| `PUSH_TOKEN` | 采集必须 | 与 Worker `PUSH_TOKEN` 相同 |
| `ADMIN_TOKEN` | 采集必须 | 与 Worker `ADMIN_TOKEN` 相同，供 `/v1/cron` |
| `COPILOT_TOKEN` | 选 | GitHub PAT |
| `COPILOT_USERNAME` | 选 | 不填则调 `/user` |
| `COPILOT_ORG` | 选 | 读 org 账单时填 |
| `COPILOT_MONTHLY_ALLOWANCE` | 选 | 默认 300 |
| `GROK_TOKEN` | 选 | xAI API key 或仍有效的 bearer |
| `ANTHROPIC_ADMIN_KEY` | 选 | Admin API key |
| `AQM_PUSH_UNSUPPORTED` | 选 | 设为 `1` 时把 Codex 占位状态也推上去 |

## Worker 路由

| 路径 | 方法 | 鉴权 |
|------|------|------|
| `/v1/push` | POST | `PUSH_TOKEN` |
| `/v1/summary` | GET | `ADMIN_TOKEN` |
| `/v1/config` | GET / PUT | `ADMIN_TOKEN` |
| `/v1/notify-test` | POST | `ADMIN_TOKEN` |

Dashboard 登录页输入 `ADMIN_TOKEN`，存在 localStorage。

## 通知

Settings 里配置 webhook：`generic` / `discord` / `ntfy` / `telegram`。  
Worker Cron 默认每 30 分钟检查剩余百分比是否低于阈值，以及数据是否超过 `staleHours` 未更新。

## 各服务可行性

见 [docs/PROVIDERS.md](docs/PROVIDERS.md)。必须按该文档理解：Codex 与 Claude 5h/7d 窗口当前不支持。
