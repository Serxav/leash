# Roadmap

One task = one branch = one pull request. Tick a box only when the task meets the
definition of done in `CLAUDE.md`. Tags close each phase.

## F0 · Setup (Oct 15–17)

- [x] Session 0: repo, `.claude/settings.json`, `.env.example`, `main` ruleset, squash-only
      merges, secret scanning, Dependabot, topics (Oct 15)
- [x] `docs/f0-context-files`: `CLAUDE.md`, `docs/*`, README skeleton, `.gitignore`
      additions
- [x] Install Node 24 LTS locally with fnm (D-003)
- [x] `chore/f0-scaffold`:
  - [x] Next.js App Router + TypeScript + Tailwind + ESLint, plus Vitest, Zod, Drizzle and
        SQLite
  - [x] Scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:sandbox`;
        `.nvmrc` and `engines`
  - [x] `src/config/env.ts`: Zod env validation and the sandbox-only guard; only the keys of
        the selected AI provider are required
  - [x] `/api/health` endpoint
  - [x] Tests for env validation (refuses live mode, wrong API URL, missing keys)
- [x] `chore/setup-ci`:
  - [x] `.github/workflows/ci.yml`: `npm ci`, lint, typecheck, test, build, gitleaks
  - [x] `.github/pull_request_template.md`
- [x] Add the CI check as a **required status check** in the `main` ruleset (after
      `chore/setup-ci` is merged)
- [x] `feat/f0-sandbox-connection`:
  - [x] Server-only PayPal OAuth client
  - [x] `npm run test:sandbox` proves the connection
- [x] Spike: check that `@paypal/agent-toolkit` is compatible with the current Vercel AI SDK
      (`npm view` + compile-only check). Record it in DECISIONS
- [x] Spike: one Channel3 search with Spain + EUR, to confirm EUR offers exist (1 credit).
      Record it in DECISIONS

## F1 · End-to-end payment (Oct 18–21) → `v0.1.0`

- [x] Read the sandbox guide and the Vault, Orders v2 and Payments v2 docs. List the
      endpoints and their doc pages before coding
- [x] Decide between `@paypal/paypal-server-sdk` and direct REST, and check whether the SDK
      is APIMatic-generated (D-007). Record it in DECISIONS (D-016: SDK + APIMatic Context Plugin)
- [x] Plan Risk Data Acquisition (FraudNet/Magnes), which the vault docs say PayPal requires
      (D-013). Check when `PayPal-Client-Metadata-Id` is needed on vaulted charges (D-018)
- [x] `feat/f1-vault-mandate`: save PayPal (setup token → buyer approval → payment token,
      `usage_type` MERCHANT)
- [x] `feat/f1-vaulted-charge`: create and capture a €5 order with `vault_id`, with
      `PayPal-Request-Id` idempotency. Verify EUR on the ES sandbox accounts
- [x] `feat/f1-refund`: refund a capture (Payments v2) (D-019)
- [x] `feat/f1-declined-error`: `INSTRUMENT_DECLINED` via `PayPal-Mock-Response`, branching
      on `details[0].issue`, keeping the `debug_id`, with a clear user message (D-020)
- [x] Minimal page that runs the whole flow (`/lab/payments`, development only). Tested with the Personal and Business accounts

## F2 · Rules (Oct 22–25) → `v0.2.0`

- [x] `feat/f2-rules-schema`: Zod rules schema (D-021)
- [x] `feat/f2-policy-engine`, tests first (D-022). Cases:
  - [x] exact limit
  - [x] budget used up
  - [x] month change in Europe/Madrid
  - [x] category not allowed
  - [x] blocked merchant
  - [x] too many units
  - [x] approval threshold
  - [x] paused agent
  - [x] revoked mandate
- [x] `feat/f2-ai-models` (D-023): `src/ai/models.ts`, the single place for provider and model
      choice
- [x] `feat/f2-rules-builder` (D-024): plain language → rules (structured output + Zod). It asks
      when a rule is ambiguous
- [x] `feat/f2-rules-confirmation` (D-026): confirmation screen with readable tags and policy
      versions
- [ ] *(Can move earlier, D-006)* UI shells for the approval inbox and history

## F3 · Agent (Oct 26–Nov 1, low pace) → `v0.3.0`

- [x] `feat/f3-channel3-catalog` (D-028): Channel3 REST API with a cache and a monthly cap,
      Spain + EUR only, local JSON fallback catalog with the trap product
- [x] `feat/f3-shopping-agent` (D-029): agent (Gemini via `src/ai/models.ts`) whose only
      purchase tool is `propose_purchase`; the server re-reads price, merchant and category
- [ ] `feat/f3-leashed-tools`: Agent Toolkit tools wrapped by the Leash permission layer
- [ ] `test/f3-prompt-injection`: the trap product is blocked and logged
- [ ] Decide how Channel3 results are shown without third-party brands in the video
      (generic queries, no product images or neutral images). Ask the Channel3 team on the
      PayPal Discord (#channel3) whether retailer names may appear. Record it in DECISIONS
- [ ] Make Channel3 visible in the demo ("Best Use of Channel3", D-030): at least one real
      Channel3 offer in the agent flow, for example by searching inside the user's allowed
      categories (`filters.category_ids`)
- [x] Sergi: apply promo code `PAYPAL-HACKATHON-2026` in the Channel3 dashboard (20,000 free
      credits, no card). Monthly cap raised from 300 to 2,000 (D-031)
- [ ] Sergi: confirm no payment method is saved in the Channel3 dashboard
- [ ] Sergi: check in the sandbox Business account that the agent's charges arrived (€5.49,
      €6.90, €10.98 on Oct 16)
- [ ] Anthropic: workspace "leash", spending limit, `leash-dev` key (Sergi, end of
      October). Run the rules-conversion tests with both providers

## F4 · Control (Nov 2–5) → `v0.4.0`

- [ ] `chore/f4-switch-to-claude`: `AI_PROVIDER=anthropic`, pass the rules and agent tests,
      tune the prompts
- [ ] `feat/f4-approval-inbox`: one-tap approve/reject, where approving triggers the charge
- [ ] `feat/f4-history`: status, amount, rule, PayPal reference, "14-day return window"
      countdown (D-008), refund button
- [ ] `feat/f4-permissions-panel`: pause the agent, revoke the mandate (deletes the vault
      token), delete the account and data
- [ ] Everything works on mobile
- [ ] *(Optional sponsor, D-007)* AG Grid for the history/audit table on desktop

## F5 · Polish (Nov 6–8) → `v0.9.0` · feature freeze on Nov 8

- [ ] Design and accessibility pass (contrast, keyboard, labels)
- [ ] Deploy on Render Starter: sandbox env vars, `AI_PROVIDER=anthropic`, `/api/health`,
      rate limit, demo data re-seeded at boot, anonymous per-session demo users, "Reset
      demo"
- [ ] Dedicated sandbox Personal account for judges, plus a backup account
- [ ] README for judges: what it is, AI used, PayPal APIs and folders, requirements,
      variables, install, run, sandbox credentials, how to test each user story
- [ ] Instructions tested from scratch on a clean machine

## F6 · Submission (Nov 9–11) → `v1.0.0`

- [ ] Claim the APIMatic free subscription (Sergi; the form is on the Devpost APIMatic page). Name the APIMatic Context Plugin on Devpost

- [ ] Final `docs/DEMO_SCRIPT.md`, ≤ 2:45
- [ ] Record the video on the real device, upload it to YouTube as **public**
- [ ] `docs/SUBMISSION.md`: Devpost texts in English
- [ ] Go through the compliance checklist in `docs/HACKATHON_RULES.md`
- [ ] Release `v1.0.0`; `main` frozen until Dec 15; new work on `next`
- [ ] **Submit on Devpost on Nov 11** (it closes Nov 12, 21:00 Madrid)

## Dec 1–15 · Judging

- [ ] Check daily that the demo is alive (`/api/health`) and that the sandbox accounts work
