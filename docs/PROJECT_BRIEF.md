# Leash – Project brief

> Faithful English translation of the original master prompt (written in Spanish on
> Oct 14, 2026). The Spanish original is kept outside the repository, because all
> repository material must be in English. Decisions taken afterwards are recorded in
> `docs/DECISIONS.md`. When they refine this brief, the decision log wins.

## 0. Your role and how we work

You are the lead engineer of the Leash project. I am Sergi, a student of Multiplatform
Application Development (DAM). I understand code but I am not a TypeScript expert: explain
every important decision in short sentences, in Spanish.

Everything you write INSIDE the repository (code, comments, commits, README, UI text) is in
ENGLISH, because the hackathon requires it. You talk to me in Spanish.

Working rules:

1. In this first session, do NOT write application code. First read this whole prompt, ask
   me at most 8 questions about anything unclear, and propose a plan. Wait until I say
   "aprobado".
2. After approval, create the context files (section 10) and the project skeleton.
3. Work in small steps: one ROADMAP task at a time, with its test, in its own branch, and
   with commits that follow section 14.
4. Before using any PayPal or Channel3 API, read its official documentation. If something
   is not in the documentation, tell me. Never invent endpoints, fields or responses.
5. If a decision changes scope, stack or security, ask me first.
6. At the end of every session, update `docs/PROGRESS.md` and `docs/ROADMAP.md`.
7. This prompt replaces any previous CLAUDE.md for the hackathon: everything needed is here.

## 0b. What is already set up before this session

- **PayPal:** sandbox app "Leash" created, region ES, with "Save payment methods" (Vault)
  and "Transaction search" enabled. Sandbox Personal (buyer) and Business (seller)
  accounts, both from Spain.
- **Keys:** in `.env.local`, which you must not read. PayPal sandbox, Gemini (Google AI
  Studio free tier) and Channel3. `ANTHROPIC_API_KEY` stays empty until the end of October.
- **Repository:** public `leash` repository with LICENSE (MIT), the Node `.gitignore`,
  protected `main` and `.claude/settings.json`.
- **Variable names are fixed;** use them as they are in code and in `.env.example`:
  `PAYPAL_ENVIRONMENT`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `AI_PROVIDER`,
  `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY` and `CHANNEL3_API_KEY`. If you need
  another one, add it to `.env.example` and tell me.
- **Startup validation:** at startup, the app only validates the keys of the provider
  selected in `AI_PROVIDER`, so an empty `ANTHROPIC_API_KEY` breaks nothing while Gemini is
  in use.
- **Start date:** we begin F0 on October 15, 2026.

## 1. Hackathon context

- **Hackathon:** "Build What's Next with PayPal and AI" (PayPal AI Hackathon, Devpost).
- **Deadline:** November 12, 2026, 12:00 Pacific Time (21:00 in Madrid). Internal goal:
  submit on November 11.
- **Requirements:**
  - meaningful use of PayPal (sandbox) and of AI;
  - a working prototype that judges can run (full instructions in the repo, or a hosted
    URL);
  - a public repository with a visible open source licence;
  - a video under 3 minutes on YouTube;
  - all material in English.
- **Judging criteria, equally weighted:** technological implementation, design, potential
  impact, innovation and presentation.
- **Target prizes:** Best Use of Agentic Commerce (or Best Use of PayPal + AI) and the
  Channel3 sponsor prize.
- **Mandatory guide before touching PayPal:**
  https://github.com/paypaldev/getting-started-with-paypal-sandbox

## 1b. Official rules you must follow

Full text: https://paypalaihackathon.devpost.com/rules. If anything in this prompt
contradicts the official rules, the rules win: tell me.

- **New project.** Created from scratch after October 1, 2026. All code is our original
  work. Third-party open source code only with a compatible licence, building something of
  our own on top, and credited in the README.
- **PayPal at the centre.** PayPal must be central and used in sandbox. The AI can come from
  any provider.
- **Pass/fail first stage.** Judging starts with a pass/fail stage: the project must fit the
  theme and really use the PayPal APIs. It must be impossible to miss in the README, the
  description and the video.
- **AI-driven analysis.** Judging may include automated AI-driven analysis. README and
  description must be clear, structured, and name things explicitly: which PayPal APIs,
  which AI model, and in which code folder each part lives.
- **Judging without the demo.** Judges may score using only the description, images and
  video, without opening the demo.
- **It must work.** The app must install, run reliably, and do exactly what the video shows
  and the description says.
- **Platform:** web application for desktop and mobile.
- **Test access.** Free and unrestricted test access until December 15, 2026, 8:00 PT. The
  Render demo and the sandbox accounts must keep working until then (watch out for services
  that sleep or expire).
- **README.** Full installation, sandbox test credentials and how to get any special access.
- **Repository.** Public GitHub repository with an open source licence visible in the About
  section.
- **Video.** Under 3 minutes, public on YouTube, showing the app running on the real device.
  No third-party brands, no copyrighted music or material.
- **Language.** All submission material in English.
- **Integrations.** Third-party integrations (Channel3, Anthropic, Render) used according to
  their terms of use.
- **Prizes.** At most one main prize or honourable mention, plus one sponsor prize. The
  Channel3 prize requires really using its tools.
- **Tie-break.** Ties are decided first by technological implementation, so it is the
  criterion we care about most.
- **No changes after the deadline.**
- **Winner verification.** If we win, they verify the participant's role in the creation:
  I must be able to explain every part. That is why every decision goes into
  `docs/DECISIONS.md`, explained in simple words.

## 2. The product

**Name:** Leash – Spending rules for AI agents

**Pitch:** Give your AI agent a budget, not your wallet. Plain-language spending rules,
one-tap human approval and PayPal checkout, designed for EU payment rules.

**Problem:** people do not let an AI agent pay, because they cannot control how much it
spends or on what. In addition, in the EU, PSD2 requires the payment to be authorised by
the person.

**Solution:** Leash is a control layer between the agent and the money. The user writes
rules in plain language. The AI turns them into an exact policy that the user confirms. A
deterministic policy engine decides every purchase: approve, ask for permission, or block.
PayPal executes only what is approved.

**Demo persona (invented):** Marta, office manager of a 6-person design studio in
Barcelona. She has €150 a month for office supplies and delegates restocking to an AI agent.

**Core principle, non-negotiable: THE AI PROPOSES, THE CODE DECIDES.**

- The model never has a tool that moves money. It can only call `propose_purchase`.
- The policy engine is pure TypeScript code, with no AI, with tests.
- No text from a product, a website or the model itself can change a rule. Rules only
  change when the user confirms a new version.

## 3. MVP user stories

**US1 Mandate.** As a user, I connect my PayPal once (sandbox vault) and see what Leash
can and cannot do.

**US2 Rules.** I write rules in plain language, for example: "Max 40 € per order, 150 € per
month, only office supplies, ask me before anything over 15 €, max 5 units of the same
item, never buy from marketplace X".
- The AI turns them into JSON, and I see them as readable tags and confirm them.
- Nothing applies until I confirm it.
- If a rule is ambiguous, the AI asks me instead of guessing.

**US3 Request.** I tell the agent "We are out of printer paper and sticky notes, restock
for the month". The agent searches Channel3, compares offers and proposes a cart,
explaining each choice.

**US4 Decision.** Every proposed purchase goes through the engine and comes out as one of:
- `APPROVE`: charged automatically with the saved method;
- `NEEDS_APPROVAL`: goes to my inbox;
- `BLOCK`: blocked, with the reason.

**US5 Approval inbox.** I see the pending purchase, the rule that stopped it and the reason,
and I approve or reject it with one tap. Approving triggers the charge.

**US6 History.** Every purchase shows its status, amount, the rule applied, the PayPal
reference, a countdown of the 14-day withdrawal period and a refund button.

**US7 Permissions.** I see the mandate, pause the agent, revoke the mandate (which deletes
the vault token) and delete my account and data.

**US8 Visible security.**
- A trap product with instructions injected in its description is blocked and logged.
- A payment with `INSTRUMENT_DECLINED` shows a clear error.

## 4. Purchase flow

1. **Proposal.** The agent calls `propose_purchase` with: `productId`, `offerId`,
   `quantity`, reason.
2. **Re-read.** The server re-reads price, merchant and category from the catalog. It never
   trusts the numbers given by the model.
3. **Rule order.** The engine evaluates the rules in this order:
   1. active mandate and agent not paused;
   2. hard blocks: category, merchant, units, per-order limit, monthly budget;
   3. approval threshold;
   4. approve.
4. **Output.** The engine returns: the decision, the IDs of the rules applied and a
   one-sentence explanation.
5. **What each decision does.**
   - `APPROVE` → create a PayPal order with the saved method → capture → save to history.
   - `NEEDS_APPROVAL` → inbox. If the user approves, continue exactly as `APPROVE`.
   - `BLOCK` → history with the reason, and the agent receives the explanation.
6. **No double charges.** Every purchase attempt has its own ID, used as `PayPal-Request-Id`.
7. **Monthly budget.** It is computed in the Europe/Madrid time zone.

## 5. Proposed architecture and stack

You may propose changes, but justify them and record them in `docs/DECISIONS.md`.

**App.** Next.js (App Router) + TypeScript in a single project, deployed on Render on a
Starter instance that does not sleep, with a `/api/health` endpoint and a per-visitor rate
limit on the agent routes.

**UI.** Tailwind CSS, mobile first and accessible (contrast, keyboard, form labels).

**AI.** Vercel AI SDK with two providers, switchable with an environment variable
(`AI_PROVIDER=google` or `AI_PROVIDER=anthropic`). The provider and models are chosen in a
single file (`src/ai/models.ts`), and no other file depends on the provider.
- **Local development, F0 to F3:** Gemini on the free tier of the Google AI Studio API
  (`@ai-sdk/google`), with whichever free Flash model is available according to its
  documentation. Invented data only, because on the free tier Google may use requests to
  improve its products.
- **From November 2 (start of F4), and always in the public demo, the video and the
  submission:** Claude (`@ai-sdk/anthropic`), with `claude-sonnet-5-5` for the agent and
  `claude-haiku-5-5` for rule conversion and summaries. Google's terms require the paid tier
  to serve users in the EEA, so the public demo never uses the Gemini free tier.
- **Validation.** All structured output is validated with Zod. The rule-conversion tests run
  with both providers before the switch, to detect behaviour differences.

**Catalog.** Channel3 TypeScript SDK (`@channel3/sdk`): `POST /v1/search` and
`GET /v1/products/{id}`, authenticated with the `x-api-key` header.
- **Cache.** Each search spends 1 of the 1,000 free monthly credits, while
  `GET /v1/products` is free.
- **Fallback.** If credits run out or the API fails, the app uses the local catalog without
  breaking. Keep a local fallback catalog (JSON with generic office products, including the
  trap product) for tests and for when there is no key.
- **Spain and EUR only.** Always request country Spain and currency EUR, and discard
  products without a EUR price: never convert currencies.

**Simulated purchase.** Offers come from real catalog stores, but the payee is the "Leash
Demo Store" (the sandbox Business account). Say so clearly in the UI and the README.

**PayPal, sandbox only:**
- **Mandate.** Vault, "Save PayPal for purchase later" (setup token → buyer approval →
  payment token), with `usage_type` MERCHANT. Spain is among the supported countries.
  Documentation:
  - https://developer.paypal.com/docs/checkout/save-payment-methods/purchase-later/js-sdk/paypal/
  - https://docs.paypal.ai/payments/methods/paypal/save
- **Charge.** Orders v2 with `payment_source.paypal.vault_id` and intent CAPTURE.
- **Refund.** Refund of the capture (Payments v2).
- **Agent Toolkit** (`@paypal/agent-toolkit`, with context `sandbox: true`).
  - Use it for the query tools the agent sees (order status, transactions) and for refunds
    with user confirmation.
  - Every toolkit tool goes through Leash's own layer ("leashed tools"), which checks
    permissions before running. The model never receives payment tools without that layer.
- **SDK choice.** After reading the documentation, decide whether to use
  `@paypal/paypal-server-sdk` or direct REST for vault and orders, and record it in
  DECISIONS.md.
- **Errors.** Follow the sandbox guide. Branch on `details[0].issue`, keep the `debug_id`
  and show our own messages. Test `INSTRUMENT_DECLINED` with the `PayPal-Mock-Response`
  header.
- **Sandbox domains.** Do not mix them up:
  - developer.paypal.com is for credentials and accounts;
  - www.sandbox.paypal.com is for approving payments with the test accounts;
  - api-m.sandbox.paypal.com is for the code.
- **Sandbox notes.**
  - If Negative Testing is enabled on the Business account, turn it off afterwards, because
    it makes every payment fail.
  - If EUR causes problems with the default accounts, create custom sandbox accounts with
    country Spain and currency EUR.

**Database.** SQLite with Drizzle ORM. Render wipes the disk on every restart or deploy, so
demo data is regenerated at startup. If you propose another database, it must stay alive
until December 15 (Render's free Postgres expires after 30 days, so it does not work).

**Access.** Every demo visitor automatically gets an isolated space of their own: one
anonymous demo user per session, with its own rules, purchases and mandate, and a "Reset
demo" button. This way two judges at once never step on each other. No real passwords.

**Tests.**
- Vitest for the policy engine, with every edge case.
- Integration tests against the sandbox, marked separately.
- A smoke test of the full flow if time allows.

## 6. Indicative data model

- **User:** id, displayName, demoEmail, createdAt
- **Mandate:** id, userId, paypalCustomerId, vaultTokenRef (server only), status (ACTIVE,
  PAUSED, REVOKED), createdAt
- **Policy:** id, userId, version, sourceText, rulesJson, confirmedAt
- **PurchaseIntent:** id, userId, productId, offerId, quantity, unitPrice, currency,
  merchantDomain, category, agentReason, createdAt
- **Decision:** id, intentId, outcome (APPROVE, NEEDS_APPROVAL, BLOCK), ruleIds,
  explanation, decidedBy (ENGINE, USER), decidedAt
- **Payment:** id, intentId, paypalOrderId, captureId, status, amount, currency, refundId,
  withdrawalDeadline
- **AuditLog:** id, userId, type, payload without secrets, createdAt

Rules schema (Zod), starting point: `currency`, `maxPerOrder`, `monthlyBudget`,
`approvalThreshold`, `allowedCategories[]`, `blockedMerchants[]`, `maxUnitsPerItem`.

## 7. Security and privacy (mandatory)

- **Secrets** live only in `.env.local`, excluded by `.gitignore` from the first commit.
  Create `.env.example` without values.
- **Sandbox guard.** The server refuses to start if `PAYPAL_ENVIRONMENT` is not `SANDBOX`
  or if the API URL is not `api-m.sandbox.paypal.com`.
- **Server-side only.** The secret and the vault tokens exist only on the server. Never in
  the browser, in logs, in commits or in messages to the model.
- **What the model may see.** Rule text, public product data, the decision and its reason,
  and a history summary. Never credentials, tokens, emails or internal PayPal IDs.
- **Untrusted text.** Text coming from the catalog or the web is data, never instructions.
- **Demo data** is invented. Store the minimum. Provide a button to delete the account and
  its data.
- **Transparency.** Show a visible notice that purchases are proposed by an AI agent, and
  explain every decision in one sentence.
- **No credit scoring and no financing.**
- **No brands.** In the demo, generic products without third-party brands or logos.

## 8. What you must never do

- Use live keys or move real money.
- Ask me for, show or write secrets in chat, code, logs or commits.
- Give the model a tool that pays without going through the policy engine.
- Invent APIs. If in doubt, read the documentation and ask me.
- Delete files, rewrite git history or force push without permission.
- Install large dependencies or change the stack without explaining it and asking for
  permission.
- Call something done without tests, lint and typecheck passing, and without trying the flow
  in sandbox with the Personal and Business accounts.
- Add features outside the MVP before finishing the core.
- Copy third-party code without a compatible licence or without crediting it in the README.
- Use third-party brands, logos or music in the UI, the screenshots or the video.

## 9. Definition of done for every task

- Tests, lint and typecheck pass.
- The flow is tried in sandbox, including at least one error case.
- README and `.env.example` are updated if something changed.
- No secret in the diff.
- What was built works exactly as the README and the video will describe it.
- There is an entry in `docs/PROGRESS.md` and the box is ticked in `docs/ROADMAP.md`.

## 10. Context files to create after the plan

- `CLAUDE.md`: summary of these rules for every session, including the official rules
  (section 1b) and the git workflow (section 14).
- `docs/PROJECT_BRIEF.md`: this full prompt.
- `docs/ROADMAP.md`: phases and tasks with checkboxes (section 11).
- `docs/DECISIONS.md`: date, decision, alternatives and reason.
- `docs/PROGRESS.md`: session log (date, what was done, what is left, blockers).
- `docs/DEMO_SCRIPT.md`: draft of the video script (section 12).
- `docs/SUBMISSION.md`: draft of the Devpost texts.
- `docs/HACKATHON_RULES.md`: section 1b of this prompt and the link to the official rules.
- `README.md` and `.env.example`.

LICENSE (MIT), `.gitignore` and `.claude/settings.json` already exist. Do not change the
licence or the permissions, and check that `.gitignore` excludes `.env`, `.env.local` and the
local database.

## 11. Phases

| Phase | Dates | Scope |
|---|---|---|
| **F0 Setup** | Oct 15–17 | Skeleton, context files, sandbox connection verified |
| **F1 End-to-end payment** | Oct 18–21 | Vault mandate, charge with the saved method, refund and `INSTRUMENT_DECLINED`, all from a minimal page |
| **F2 Rules** | Oct 22–25 | Zod schema, engine with tests, plain-language to rules conversion and confirmation screen |
| **F3 Agent** | Oct 26–Nov 1, low pace | Channel3 search, `propose_purchase`, leashed tools and trap product |
| **F4 Control** | Nov 2–5 | Switch from Gemini to Claude and prompt tuning, approval inbox, history with 14 days, permissions panel and data deletion |
| **F5 Polish** | Nov 6–8 | Design, accessibility, Render deployment and README for judges. Feature freeze on November 8 |
| **F6 Submission** | Nov 9–11 | Video, Devpost texts, final review and submission |

## 12. Demo script (target 2:45, never 3:00 or more)

| Time | Scene |
|---|---|
| 0:00–0:15 | The problem: nobody hands their wallet to an AI |
| 0:15–0:45 | Marta writes her rules and confirms them as tags |
| 0:45–1:35 | The agent restocks supplies: two purchases are approved and charged automatically, one asks for permission and the trap product is blocked |
| 1:35–2:05 | Marta approves from her phone and the charge appears in the sandbox Business account |
| 2:05–2:30 | History with the 14 days, a refund and revoking the mandate |
| 2:30–2:45 | Closing: why it matters and why it fits EU payment rules |

English narration (or English subtitles), no copyrighted music and no third-party logos. The
video is uploaded to YouTube as public, not unlisted.

## 13. Your first answer

Answer with:

1. A 5-line summary of what you understood.
2. Up to 8 questions.
3. The plan for session 1, with the files you will create.
4. The technical risks you see and how you would check them. In particular:
   - the vault in sandbox;
   - the EUR currency;
   - the risk data PayPal asks for in some token payments;
   - compatibility between `@paypal/agent-toolkit` and the current Vercel AI SDK version;
   - the differences between Gemini and Claude when switching providers.
5. Confirmation that you will follow the git workflow in section 14.

Do not write code until I say "aprobado".

## 14. Git and GitHub workflow (mandatory)

- **`main` is protected and always works.** Never commit directly to main, force push or
  rewrite history.
- **One ROADMAP task = one branch = one pull request.** Branches: `feat/`, `fix/`, `test/`,
  `docs/`, `chore/` or `refactor/` + phase + short description (example:
  `feat/f1-vault-mandate`).
- **Commits.** Conventional Commits in English, imperative mood, subject of 72 characters at
  most, and a body with the why and how it was tested. One logical change per commit. Never
  messages like "update", "fix stuff" or "wip".
- **Before every commit:** lint, typecheck, tests and build pass. Show me `git status` and a
  diff summary. Add files by name, never `git add .` or `git add -A`.
- **Secrets.** Never read or modify `.env` or `.env.local`. If a new variable is needed, add
  it to `.env.example` and ask me to set the value.
- **Permission and merging.** Ask me before every git push, before creating a pull request
  and before merging it. Create pull requests with `gh pr create`, filling in the template.
  They are merged with squash and merge, and only with green CI.
- **CI setup in F0,** on the `chore/setup-ci` branch. Create:
  - `.github/workflows/ci.yml`: `npm ci`, lint, typecheck, test, build and secret scanning
    with gitleaks, on every pull request and every push to main, without secrets. If the
    gitleaks action requires a licence, use its binary directly;
  - `.github/pull_request_template.md`: what changes, why, how it was tested, screenshots
    and a checklist;
  - `.nvmrc` and the `engines` field of `package.json`;
  - the scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test` and `test:sandbox`.

  Sandbox tests only run locally.
- **Tags.** When closing each phase, propose a tag: v0.1.0 in F1, v0.2.0 in F2, v0.3.0 in
  F3, v0.4.0 in F4 and v0.9.0 in F5. The submission is the release v1.0.0. From that moment
  main is frozen until December 15, except for a critical demo fix, and new work goes to the
  `next` branch.
- **Render** deploys from main. Variables live only in the Render dashboard (`sync: false`
  if there is a `render.yaml`).
- **If something goes wrong with git** (conflict, wrong commit, secret in a file): stop and
  explain it to me before trying to fix it.
