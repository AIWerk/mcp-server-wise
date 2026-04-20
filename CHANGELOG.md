# Changelog

All notable changes to `@aiwerk/mcp-server-wise` are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## 0.1.5 — 2026-04-21

Docs-only release.

### Docs
- README: Split install into Hosted (aiwerkmcp.com) and Self-hosted (npx) options. The hosted option lands on `bridge.aiwerk.ch/u/<user-id>/mcp` with zero local setup — token AES-256-GCM encrypted via Vault.
- README: Added "About AIWerk MCP" footer cross-linking cal, imap, clawhub.

### Package metadata
- Added `bugs` URL field (alongside existing `homepage` and `repository`) — surfaces on npmjs.com and external catalogs.

## 0.1.4 — 2026-04-20

Third Axel-review pass — build workflow tightening.

### Build / dev

- **`npm run dev` no longer forwards a stale VERSION.** New `predev` hook runs `gen-version` before `tsc --watch`, matching `prebuild` / `pretest`. Previously a `package.json` version bump followed by `npm run dev` would serve the old version until the next explicit build.
- **`gen-version` is idempotent.** Only writes `src/version.ts` when the content actually changes. Running `npm run build` or `npm test` on an in-sync tree no longer dirties the working copy.
- **README build/dev notes.** Explicit section documenting that `src/version.ts` is generated+committed, and that bumping `package.json` and running any of `build` / `dev` / `test` propagates the version automatically.

### Known trade-offs (documented)

- `src/version.ts` is a tracked source file written by the build. Accepted pattern — fresh clones compile without an extra step, and the idempotent write keeps the tree clean when the version is in sync.
- `server.test.ts` still reaches into `@modelcontextprotocol/sdk` private fields (`_registeredTools`, …) for tool-registry inspection. Flagged as brittle with a migration note — we'll switch to an `InMemoryTransport` + `client.listTools()` public introspection when the SDK exposes one.

## 0.1.3 — 2026-04-20

Second Axel-review round — four precision fixes.

### Security / reliability

- **`WISE_API_TIMEOUT_MS` strict.** Invalid values (non-numeric, zero, negative, trailing garbage) now throw `WiseConfigError` instead of silently falling back to the 30s default. Missing / empty env still falls back.

### Input validation

- **ISO-8601 real-date check.** Previous regex accepted `2026-02-30` (JavaScript's `Date.parse` wraps it to March). New validator round-trips year/month/day through `Date.UTC` and rejects any mismatch. Feb 30, month 13, day 32, and non-leap Feb 29 are all caught.
- **Currency codes refined.** `source` / `target` / `currency` on rates, transfers, and recipients now use `/^[A-Za-z]{3}$/` with a transform-to-uppercase. Previously accepted `123`, `1$%`, `E€R`. Tool implementations keep defensive `.toUpperCase()` for direct callers that bypass zod.

### Build

- **Build-time `VERSION` constant.** `scripts/gen-version.mjs` writes `src/version.ts` from `package.json` before `tsc` / `vitest` run. Drops the runtime dual `../package.json` / `../../package.json` fallback in `server.ts`.

### Tests

- 85 total (up from 59). New `validators.test.ts` (25 tests) covers ISO-8601 edge cases and currency regex. `api.test.ts` gained five `WISE_API_TIMEOUT_MS` validation cases.

### Docs / tests meta

- `server.test.ts` now has a loud "⚠️ BRITTLE — SDK INTERNAL FIELDS" block and a friendlier error message on SDK private-field drift, with a migration note to `InMemoryTransport` + `client.listTools()` when the SDK exposes a stable introspection API.

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
