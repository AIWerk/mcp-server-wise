# @aiwerk/mcp-server-wise

Wise (TransferWise) Personal API MCP server. Read-only: profiles, balances, rates, transfers, recipients.

## Tools (v0.1.2, 11 read-only)

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

## Install & run

```bash
npm install -g @aiwerk/mcp-server-wise
WISE_API_TOKEN=xxx mcp-server-wise
```

Or via npx:

```bash
WISE_API_TOKEN=xxx npx @aiwerk/mcp-server-wise
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

## Licence

MIT © 2026 AIWerk
