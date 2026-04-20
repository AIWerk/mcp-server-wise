# @aiwerk/mcp-server-wise

Wise (TransferWise) Personal API MCP server. Read-only: profiles, balances, rates, transfers, recipients.

## Tools (v0.1.0, read-only)

- `wise_list_profiles`, `wise_get_profile`
- `wise_list_balances`, `wise_get_balance`
- `wise_get_exchange_rate`, `wise_get_exchange_rate_history`
- `wise_list_transfers`, `wise_get_transfer`
- `wise_list_recipients`, `wise_get_recipient`, `wise_get_account_requirements`

Write tools (create/fund/cancel transfer, create/delete recipient) are intentionally **not in v0.1.0** — they require additional idempotency + SCA handling, planned for v0.2.0.

## Configuration

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `WISE_API_TOKEN` | yes | — | Personal API token from https://wise.com/settings/api-tokens |
| `WISE_API_BASE_URL` | no | `https://api.wise.com` | Override for sandbox (`https://api.sandbox.transferwise.tech`) |

## Install & run

```bash
npm install -g @aiwerk/mcp-server-wise
WISE_API_TOKEN=xxx mcp-server-wise
```

Or via npx:

```bash
WISE_API_TOKEN=xxx npx @aiwerk/mcp-server-wise
```

## Typical flow

1. `wise_list_profiles` → pick `profileId`
2. `wise_list_balances({profileId})` → see available currencies / amounts
3. `wise_get_exchange_rate({source, target})` → check rate
4. `wise_list_transfers({profileId, status})` → history / status lookup

## Licence

MIT © 2026 AIWerk
