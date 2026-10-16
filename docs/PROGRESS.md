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

## 2026-10-15 · Session 1 (cont.) – F1: declined payment

**Done**
- `feat/f1-declined-error` (D-020):
  - sandbox negative testing on create order (`PayPal-Mock-Response`), allowlisted to
    `INSTRUMENT_DECLINED`;
  - plain user messages for every known issue, with a safe fallback that never claims no
    money moved;
  - lab "Simulate a declined €5.00 charge" button; failed payments show the message.
- **Verified in the sandbox:** PayPal answered `INSTRUMENT_DECLINED` (debug ID
  `70c28ae654da`), the payment was recorded as `DECLINED` and the message shown.
- Tests: 85 unit and 7 sandbox, all passing.
- The whole F1 flow now runs from `/lab/payments`: connect PayPal (Personal account) →
  charge (received by the Business account) → refund → declined payment.

**Left**
- Tag `v0.1.0` after this PR is merged. Then F2 (rules) from Oct 22.

**Lesson**
- If the dev browser tab keeps reloading after restarting `npm run dev`, close the tab and
  open a new one: the old tab's hot reload was stuck on the previous server.

## 2026-10-15 · Session 1 (cont.) – F1 closed, F2 started

**Done**
- Tag `v0.1.0`: F1 (end-to-end payment) closed.
- `feat/f2-rules-schema` (D-021): strict Zod rules schema, money helper in integer cents,
  stable rule IDs. Security review: unknown fields rejected, required capped limits,
  closed formats for categories and merchants, no echo of untrusted values, no ReDoS.
- Tests: 171 unit (86 new), all passing.

**Left**
- `feat/f2-policy-engine` (tests first), then AI models, rules builder and confirmation.

**Note**
- Sergi plans a big design pass later: keep UI work functional and minimal until then.

## 2026-10-15 · Session 1 (cont.) – F2: policy engine

**Done**
- Demo for Sergi: €5 charge, refund and declined payment live in the sandbox lab, plus
  the rules schema rejecting injected fields and text.
- `feat/f2-policy-engine` (D-022), tests first:
  - `decide()`: state → hard blocks → approval threshold → approve, with rule IDs and a
    one-sentence explanation;
  - monthly budget per calendar month in Europe/Madrid, in integer cents;
  - security review: fails closed on invalid rules, inputs, history or clock; no type
    coercion; no echo of invalid text; look-alike merchants are not confused.
- Tests: 238 unit (67 new), all passing.

**Left**
- `feat/f2-ai-models`, `feat/f2-rules-builder`, `feat/f2-rules-confirmation`.

## 2026-10-15 · Session 1 (cont.) – F2: AI models

**Done**
- `feat/f2-ai-models` (D-023): `src/ai/models.ts`, the single place for provider and model
  choice; server-only, explicit keys from the validated env, no gateway routing.
- AI SDK packages installed with exact versions at least a week old (supply-chain
  precaution); `npm audit`: 0 vulnerabilities.
- Found that `gemini-2.5-flash` (D-004) is no longer callable by new users. Sergi chose the
  cheapest working model: `gemini-3.1-flash-lite` (free tier).
- Tests: 246 unit (8 new) and a live provider check, all passing.

**Left**
- `feat/f2-rules-builder`, `feat/f2-rules-confirmation`, then tag `v0.2.0`.

**Lesson**
- A model in the provider's list is not proof it can be called: always try one real call.

## 2026-10-15 · Session 1 (cont.) – F2: rules builder

**Done**
- `feat/f2-rules-builder` (D-024): plain language → rules or questions. The model extracts
  a loose draft; the code reads amounts, asks for missing values, sets currency and format
  and validates with the strict schema.
- Security review: no tools, temperature 0, timeout, capped and delimited user text, no
  echo of invalid values or provider errors, model output never trusted.
- Live check with Gemini: English and Spanish examples work; vague text and injection
  attempts give questions.
- Tests: 291 unit (45 new) and 3 live builder checks, all passing.

**Left**
- `feat/f2-rules-confirmation` (UI, minimal until the design pass), then tag `v0.2.0`.

## 2026-10-16 · Session 2 – repository review

**Done**
- Reviewed Sergi's PR #13 (LICENSE): closed without merging, because `main` had no
  duplicate and the change made GitHub report the licence as "Other" instead of MIT. Its
  branch was deleted.
- Full repository review (`chore/f2-repo-review`):
  - GitHub settings, ruleset, required checks and tags match D-001 and D-012; CI on `main`
    is green; no secret-scanning alerts;
  - no secrets in the code or in the whole git history; `.env.example` has no values;
  - **fixed:** `.gitignore` did not cover the SQLite `-wal`/`-shm` files or `data/`, which
    hold vault payment tokens. They were only excluded on Sergi's machine;
  - **fixed:** Next.js warned about a stray lockfile in a parent folder; `turbopack.root`
    now points at the project;
  - README status updated (it still said F0), DECISIONS D-001 and D-010 brought up to date;
  - `npm audit`: 0 vulnerabilities in what ships; dev-only findings documented in D-010.
- Lint, typecheck, 291 tests and build pass.

**Left**
- `feat/f2-rules-confirmation`, then tag `v0.2.0`.

## 2026-10-16 · Session 2 (cont.) – key leak review

**Done**
- Merged PR #14 (repository review fixes).
- Checked the official rules: they ask for a way to test the project, never for our keys.
- `chore/f2-server-only-guards` (D-025): `server-only` on the env, PayPal OAuth, PayPal SDK
  and database modules; a throwaway browser component importing the env file made the
  build fail, as intended. Vitest uses a stub for `server-only`.
- Scanned the 49 browser-facing build files for every real key value and key pattern:
  nothing found.
- Lint, typecheck, 291 unit tests and build pass; sandbox PayPal and Gemini checks pass.

**Note**
- One live Gemini check timed out once (slow answer) and passed on retry.

**Left**
- `feat/f2-rules-confirmation`, then tag `v0.2.0`. Repeat the browser scan before F6.

## 2026-10-16 · Session 3 – rules confirmation

**Done**
- `feat/f2-rules-confirmation` (D-026): the `/rules` page. The user writes rules, sees the
  AI's questions or the exact rules as readable tags, and confirms them. Each confirmation
  is a new policy version; nothing applies before it.
  - `policies` table (migration `0002`): drafts and confirmed versions;
  - `src/rules/policies.ts`: save, discard and confirm drafts, active policy, version list;
    fails closed if the stored rules cannot be read;
  - `src/rules/describe.ts`: readable tags, written by code, not by the AI;
  - home page links to `/rules`.
- Security: the browser never sends rules back, only a random draft ID; a draft can be
  confirmed once, only by its user, and only if it is the last one shown. The browser
  output was scanned again: no prompt, key names or key patterns.
- Lint, typecheck, unit tests and build pass.
- Tried in the browser with the real model (Gemini): Marta's rules became the right tags
  and were confirmed as version 1; new rules became version 2, with version 1 listed
  under "Earlier versions". When the AI failed, version 1 stayed in use and the text was
  kept.
- Gemini fix (D-027): `gemini-3.1-flash-lite` answered "high demand" (503) to every call
  for about 15 minutes. Development now uses `gemini-3.5-flash-lite`, and a busy answer
  (503/429) sends the same call to `gemini-3.1-flash-lite`. Both free tier, no billing.
  The prompt now asks for English category slugs. Live tests pass, with a new Spanish case.

**Left**
- Tag `v0.2.0` after merging (F2 done, except the optional UI shells).
- F3: the agent. F5: per-visitor users and rate limit before deploying.
