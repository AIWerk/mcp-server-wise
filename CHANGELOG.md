# Changelog

All notable changes to `@aiwerk/mcp-server-wise` are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## 0.1.2 — 2026-04-20

Addresses the Axel + self-review findings on 0.1.1.

### Security

- **Base URL hardening.** `WISE_API_BASE_URL` now requires `https://` and a host from the allowlist (`api.wise.com`, `api.sandbox.transferwise.tech`). Anything else throws `WiseConfigError` before the Bearer token is sent. New `WISE_API_ALLOW_UNSAFE_BASE_URL=1` escape hatch for local-mock-server use, documented as dangerous in README.

### Reliability

- **Fetch timeout** via `AbortController`. Default 30s, overridable via `WISE_API_TIMEOUT_MS`.
- **Error taxonomy.** New classes: `WiseTimeoutError`, `WiseNetworkError`, `WiseConfigError`. Existing `WiseApiError` unchanged. `toolError()` routes each class to a distinct user-facing prefix.

### Developer ergonomics

- **Input validation tightened.**
  - `types` on `wise_list_balances` is regex-refined to `STANDARD|SAVINGS` comma-separated.
  - `from` / `to` on `wise_get_exchange_rate_history` and `createdDateStart` / `createdDateEnd` on `wise_list_transfers` are refined to ISO-8601 datetime.
  - `status` on `wise_list_transfers` accepts known values (documented) plus any string as an escape hatch for forward-compat.
- **Removed dead API surface.** `wiseApi.post/.put/.delete` exports removed — v0.1.x is read-only. Write verbs will return in v0.2.0 alongside the idempotency + SCA state machine.

### Tests

- 59 tests (up from 28). New suites:
  - `server.test.ts` — server-level registration (11 tools, names, readOnlyHint on all), `toolError` error-type routing, `isCliEntry` realpath fix.
  - Expanded `api.test.ts` — base URL hardening, timeout (`WiseTimeoutError`), network errors, JSON parse failures, plain-text error bodies, read-only API surface assertion.

### Docs

- README: tool count fixed (10 → 11), `wise_get_account_requirements` added to the list, version bumped, `Base URL safety` section documents the new behavior.
- `server.ts` header comment fixed (10 → 11 tools).

## 0.1.1 — 2026-04-20

- CLI entry fix: resolve symlinks before the `isCliEntry` check so `npx @aiwerk/mcp-server-wise` invocations actually run `main()`. The previous naive `import.meta.url === process.argv[1]` check failed under npm's bin-shim indirection, causing the server to silently exit on first run via npx.

## 0.1.0 — 2026-04-20

- Initial release. 11 read-only tools over profiles, balances, rates, transfers, recipients.
