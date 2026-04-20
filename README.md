# @aiwerk/mcp-server-wise

Wise (TransferWise) Personal API MCP server. Read-only: profiles, balances, rates, transfers, recipients.

## Tools (v0.1.4, 11 read-only)

- `wise_list_profiles`, `wise_get_profile`
- `wise_list_balances`, `wise_get_balance`
- `wise_get_exchange_rate`, `wise_get_exchange_rate_history`
- `wise_list_transfers`, `wise_get_transfer`
- `wise_list_recipients`, `wise_get_recipient`, `wise_get_account_requirements`

Write tools (create/fund/cancel transfer, create/delete recipient, create quote) are intentionally **not in v0.1.x** — they require idempotency + SCA state-machine handling, planned for v0.2.0.

## Configuration

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `WISE_API_TOKEN` | yes | — | Personal API token from https://wise.com/settings/api-tokens |
| `WISE_API_BASE_URL` | no | `https://api.wise.com` | Sandbox override: `https://api.sandbox.transferwise.tech` |
| `WISE_API_TIMEOUT_MS` | no | `30000` | Per-request timeout |
| `WISE_API_ALLOW_UNSAFE_BASE_URL` | no | — | **Dangerous override** — see below |

### Base URL safety

`WISE_API_BASE_URL` is locked down by default:

- Must use `https://`
- Host must be on the allowlist: `api.wise.com` or `api.sandbox.transferwise.tech`

Violation throws `WiseConfigError` before any Bearer token leaves the machine. This prevents token exfiltration via a misconfigured env, a bad CI value, or a malicious override.

> **Dangerous override:** set `WISE_API_ALLOW_UNSAFE_BASE_URL=1` to bypass both checks (allow `http://` and arbitrary hosts). Only use for local testing against a mock server. **Never enable this in production or with a real Wise token.** The token will be sent to whatever host you configure.

## Install

Two ways to run this server — pick the one that fits.

### Option 1 — Hosted (zero setup)

No local runtime, no env vars on your machine — your Wise token is AES-256-GCM encrypted server-side via HashiCorp Vault.

1. Sign up at **[aiwerkmcp.com](https://aiwerkmcp.com)**.
2. Install **Wise** from the catalog and paste your `WISE_API_TOKEN`.
3. Point your MCP client (Claude.ai, Cursor, Hermes, …) at your hosted endpoint:
   ```
   https://bridge.aiwerk.ch/u/<your-user-id>/mcp
   ```
   with your Bearer token.

All 11 read-only tools appear. Install other AIWerk recipes from the same bridge.

### Option 2 — Self-hosted (npx)

Run directly — you manage the token:

```bash
WISE_API_TOKEN=xxx npx @aiwerk/mcp-server-wise
```

Or install globally:

```bash
npm install -g @aiwerk/mcp-server-wise
WISE_API_TOKEN=xxx mcp-server-wise
```

## Error taxonomy

Errors surface as MCP `isError: true` responses with distinct prefixes:

- `Timeout: …` — request exceeded `WISE_API_TIMEOUT_MS` (wraps `AbortController`)
- `Network error: …` — fetch rejected (DNS, connection reset, etc.)
- `Configuration error: …` — missing token or invalid base URL
- `Wise API error <status> …` — HTTP 4xx/5xx response from Wise

## Typical flow

1. `wise_list_profiles` → pick `profileId`
2. `wise_list_balances({profileId})` → see available currencies / amounts
3. `wise_get_exchange_rate({source, target})` → check rate
4. `wise_list_transfers({profileId, status})` → history / status lookup

## Build / dev notes

- `src/version.ts` is **generated** from `package.json` by `scripts/gen-version.mjs` (runs as `prebuild` / `predev` / `pretest`). The file IS committed so a fresh clone compiles immediately.
- The generator is idempotent: it only writes when the version actually changes. So `npm run build` on an in-sync tree leaves the working copy clean.
- Bumping `package.json`'s version and running any of `build` / `dev` / `test` is enough to propagate — no separate manual step on `src/version.ts`.

## About AIWerk MCP

Part of the **[AIWerk MCP platform](https://aiwerkmcp.com)** — curated, signed MCP recipes served either as npm packages for self-hosting or through our multi-tenant hosted bridge (`bridge.aiwerk.ch`).

Other AIWerk MCP servers:

- [@aiwerk/mcp-server-cal](https://github.com/AIWerk/mcp-server-cal) — Cal.com scheduling
- [@aiwerk/mcp-server-imap](https://github.com/AIWerk/mcp-server-imap) — IMAP/SMTP email, provider-agnostic
- [@aiwerk/mcp-server-clawhub](https://github.com/AIWerk/mcp-server-clawhub) — ClawHub skill catalog

Browse the full catalog (20+ recipes including GitHub, Linear, Notion, Stripe, …) at [aiwerkmcp.com](https://aiwerkmcp.com).

## Licence

MIT © 2026 AIWerk
