# AQM 各服务可行性

实现时每个 collector 独立 try/catch，单个失败只写自己的 snapshot，不影响其它 provider。

| 服务 | 可行性 | 本仓库策略 | 需要的 Secret | 说明 |
|------|--------|------------|---------------|------|
| GitHub Copilot | 较高 | **已实现** | `COPILOT_TOKEN`（PAT，建议 classic + `user` / `read:user`；读取账单还需 **Plan:read** 或 org **Administration:read**） | 调官方 Billing Usage：`/users/{user}/settings/billing/premium_request/usage` 与 `.../ai_credit/usage`。月度额度默认按 300 估算，可用 `COPILOT_MONTHLY_ALLOWANCE` 覆盖。 |
| Grok Build / xAI | 中等 | **已实现（尽力）** | `GROK_TOKEN` | 先打官方 `GET https://api.x.ai/v1/api-key`，用 spend cap 算剩余。SuperGrok / Grok Build 的 5h、7d 窗口**没有稳定公开 API**；token 过期后必须手动更新 Actions Secret。 |
| Claude API 用量 | 中等 | **已实现** | `ANTHROPIC_ADMIN_KEY` | 仅官方 Admin `usage_report/messages`。这是 token 计数，不是订阅余量百分比。普通 Messages API Key 不够。 |
| Claude 订阅窗口（5h / 7d） | 很低 | **占位** | 无 | `scripts/claude-subscription.ts` 只返回 `error`。当前没有稳定官方 headless 方式。 |
| Codex / ChatGPT 订阅额度 | 极低 | **不实现** | 无 | `scripts/codex.ts` 固定返回不支持。风险高、易失效，禁止强行抓网页 session。 |

## 安全边界

- Actions 只向 Worker `POST /v1/push` 用量 JSON。
- **禁止**把 Copilot PAT、xAI token、Anthropic key 写入 Worker / KV / 前端。
- `PUSH_TOKEN` 与 `ADMIN_TOKEN` 分离。

## 失败语义

| 情况 | snapshot.status |
|------|-----------------|
| 拉到可用窗口或 token 计数 | `ok` |
| 凭证有效但字段不全 | `partial` |
| 401 / 403 | `auth_expired` |
| 其它失败 | `error` |
