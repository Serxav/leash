# Progress log

One entry per session: date, what was done, what is left, blockers.

---

## 2026-10-15 · Session 0 – environment and repository

**Done**
- Checked the tools: Node v26.8.2, git 2.55 (with `pull.ff only` set), GitHub CLI 2.100
  logged in as `Serxav` with the `repo` + `workflow` scopes.
- Created the public repo `Serxav/leash` with the MIT licence and the Node `.gitignore`.
  Checked that `.env` and `.env.local` are ignored.
- Committed `.claude/settings.json` and `.env.example` directly to `main`. This is the only
  direct commit, made before protection.
- Set up the repo (D-001):
  - squash-only merges, with branches deleted on merge;
  - secret scanning, push protection and Dependabot alerts;
  - the "Protect main" ruleset;
  - the topics `paypal`, `ai-agents` and `hackathon`.
- Created `.env.local` locally (git-ignored, file mode 600). Checked it without printing any
  value:
  - PayPal sandbox OAuth works (HTTP 200), and the app's scopes include **vault** and
    **transaction search (reporting)**.
  - The Gemini key works, and `gemini-2.5-flash` is available.
  - The Channel3 key looks well formed, but has not been called yet.

**Left**
- Channel3 live check (F0 spike).

**Blockers**
- None.

## 2026-10-15 · Session 1 – F0 kick-off

**Done**
- Read the master prompt and checked the official rules on Devpost. Findings:
  - Only AG Grid, APIMatic, Bryntum, Channel3 and Render have sponsor prizes.
  - The cap is one grand prize or honorable mention, plus one sponsor prize.
- Plan approved. Decisions D-002 to D-009 recorded.
- `docs/f0-context-files`: `CLAUDE.md`, `docs/*`, README skeleton, `.gitignore`
  additions. Merged in PR #1.
- Installed Node 24.22 with fnm. It switches automatically by `.nvmrc`, and other projects
  stay on Node 26.
- `chore/f0-scaffold`, see D-010 and D-011:
  - Next.js 16 + Tailwind + ESLint, plus Vitest, Zod, Drizzle and `better-sqlite3`;
  - Zod env validation and the sandbox-only startup guard;
  - `/api/health`;
  - 15 unit tests.
- Results: test, typecheck, lint and build pass; startup guard checked with `next start`.

- `chore/setup-ci` (D-012): GitHub Actions CI with two jobs, checks and a gitleaks
  history scan, plus the PR template. gitleaks 8.30.1 was run locally first: 4 commits
  scanned, no leaks.

- PR #3 merged with green CI. Both checks are now **required** in the `main` ruleset (strict:
  the branch must be up to date).
- `feat/f0-sandbox-connection`:
  - server-only PayPal OAuth client (D-013) with 10 unit tests;
  - `npm run test:sandbox` passes against the real sandbox: token received, vault and
    reporting scopes present, 401 on wrong credentials.
- Agent Toolkit spike (D-014): v1.11.0 needs `ai` v4 and `zod` v3, so leashed tools will
  delegate to the toolkit's `execute`.
- Channel3 spike (D-015): Spain + EUR works (9/9 offers in EUR, categories present).
- F1 inputs found:
  - the PayPal Server SDK is APIMatic-generated;
  - its Vault controller is US-only, so the vault will use REST (Spain is supported by the
    API);
  - RDA (FraudNet/Magnes) is required.

**Left**
- F0 is complete once this PR merges.
- Next is F1 (Oct 18–21): read the Vault, Orders v2 and Payments v2 docs, decide on the
  SDK vs REST question and on APIMatic, and plan RDA.

**Blockers**
- None.

## 2026-10-15 · Session 1 (cont.) – F1 starts: vault mandate

**Done**
- Read the docs and listed every F1 endpoint with its doc page before coding. Plan approved.
- APIMatic: its sponsor prize is for using the **APIMatic Context Plugin for PayPal**.
  Installed it in Claude Code (pinned commit, telemetry off, skills only) and built with its
  TypeScript skills (D-016).
- Added `@paypal/paypal-server-sdk` 2.5.0 (pinned). Its Vault controller works for our
  Spanish sandbox accounts, despite the README's "US only".
- `feat/f1-vault-mandate`:
  - SQLite + Drizzle `mandates` table and migrations;
  - SDK client;
  - PayPal error mapping (`details[0].issue`, `debug_id`);
  - mandate service (start / complete / cancel);
  - dev-only `/lab/payments` page (D-017).
- Tests: 42 unit (17 new) and 4 sandbox, all passing.
- **US1 verified end to end in the sandbox:** connect → approval with the Personal (ES)
  account on www.sandbox.paypal.com → back to Leash → mandate `ACTIVE`, with the vault
  token stored server-side only.

**Left**
- `feat/f1-vaulted-charge` (with RDA/FraudNet), `feat/f1-refund`, `feat/f1-declined-error`.

**Blockers**
- None.

**Lesson**
- The approval must happen in the same browser tab Leash opened, logged in with the
  `…@personal.example.com` sandbox account. Typing any other email leads to PayPal's guest
  card form.

## 2026-10-15 · Session 1 (cont.) – F1: vaulted charge

**Done**
- `feat/f1-vaulted-charge` (D-018):
  - `payments` table;
  - charge service (Orders v2 + `vault_id`, idempotent, `stored_credential`
    CUSTOMER/MERCHANT);
  - FraudNet component;
  - lab "Charge €5" button;
  - optional `PAYPAL_MERCHANT_ID`.
- Found and fixed: `next/script` never ran FraudNet inside a `<Suspense>` boundary. Now a
  plain async script.
- **Verified in the sandbox:**
  - €5.00 CUSTOMER charge COMPLETED in EUR to the Business account (€4.48 net), confirmed
    through the Payments API;
  - €1.00 MERCHANT charge COMPLETED (sandbox test).
- Tests: 62 unit and 5 sandbox, all passing.
- Sergi reset the sandbox account passwords: PayPal no longer shows them, and a new one
  must differ from the old one.

**Left**
- `feat/f1-refund`, `feat/f1-declined-error`, then tag `v0.1.0`.

**Note**
- After adding a migration, restart `npm run dev`: migrations run once per server process.

## 2026-10-15 · Session 1 (cont.) – F1: refund

**Done**
- `feat/f1-refund` (D-019):
  - refund service: full refund with Payments v2, idempotent `PayPal-Request-Id`
    derived from the payment, owner and status checks;
  - `CAPTURE_FULLY_REFUNDED` syncs the record; other errors keep the payment unchanged;
  - lab "Refund in full" button per completed payment;
  - the return window is only shown for completed payments.
- **Verified in the sandbox:**
  - the €5.00 lab payment refunded from the button (refund `72C560913E260084A`);
  - sandbox test: €1.00 charge → refund → second refund rejected with
    `CAPTURE_FULLY_REFUNDED`.
- Tests: 73 unit and 6 sandbox, all passing.

**Left**
- `feat/f1-declined-error`, then tag `v0.1.0`.
