# Leash – Spending rules for AI agents

> **Give your AI agent a budget, not your wallet.** Plain-language spending rules, one-tap
> human approval and PayPal checkout, designed for EU payment rules.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/) on Devpost.
This is a web application for desktop and mobile, created from scratch during the
submission period. It uses the **PayPal sandbox only**: no real money ever moves.

> **Status: under active development.** The end-to-end PayPal payment works in the sandbox
> (`v0.1.0`), and the spending rules are in progress (phase F2). Sections marked
> **Implemented** exist today; the rest describes the planned design. See
> [docs/ROADMAP.md](docs/ROADMAP.md).

## What it is

People don't let AI agents pay because they can't control how much the agent spends or on
what. In the EU, PSD2 also requires the person to authorise payments. Leash is a control
layer between an AI shopping agent and the user's money:

1. **Rules in plain language.** The user writes spending rules ("max €40 per order, €150 per
   month, office supplies only, ask me above €15"). The AI turns them into exact JSON rules,
   which the user confirms.
2. **The AI proposes, the code decides.** The agent can only *propose* purchases. A
   deterministic policy engine, plain TypeScript with no AI, decides `APPROVE`,
   `NEEDS_APPROVAL` or `BLOCK`. **Implemented:** the strict rules schema
   (`src/rules/schema.ts`), the policy engine (`src/rules/engine.ts`), the plain-language
   rules builder (`src/rules/builder.ts`) and the `/rules` page, where the user checks the
   rules as readable tags and confirms them as a new version (`src/rules/policies.ts`).
   **Implemented:** the shopping agent (`src/agent/agent.ts`, page `/agent`). Its only tools
   are a catalog search and `propose_purchase`; the server re-reads price, shop and category,
   runs the engine and charges only approved purchases (`src/purchases/propose.ts`).
   **Implemented:** prompt-injection defence (`src/security/`). Shop text that gives orders
   to AI agents is found by plain code, hidden from the agent and never bought, and each case
   appears in the security log on `/agent`.
   **Implemented:** the approval inbox (`/inbox`, `src/purchases/approve.ts`). Purchases
   above the user's approval amount wait there; one tap approves or rejects. Approving does
   not skip the checks: Leash re-reads the price and runs the engine again with the current
   rules and budget, blocks it if the price went up or a rule now fails, and only then
   charges (D-036).
   **Implemented:** the purchase history (`/history`): every proposal with its decision and
   rule, the PayPal transaction ID, the "14-day return window" countdown (D-008) and a
   refund button while it is open (D-037).
3. **PayPal executes only what is approved.** The user saves PayPal once (the mandate).
   Approved purchases are charged with the saved method, and refunds go back through PayPal.
4. **The user stays in control** (`/permissions`, D-038). Pause the agent (Leash blocks
   every purchase, approvals included), revoke the mandate (Leash stops charging at once
   and PayPal deletes the saved token), or delete the account and all its data.

## Planned PayPal integration (sandbox)

| PayPal API | Used for |
|---|---|
| Vault – save PayPal for purchase later | The user's mandate (payment token). **Implemented:** `src/payments/mandate.ts`, including revoking it from `/permissions` (`DELETE /v3/vault/payment-tokens/{id}`, D-038) |
| Orders v2 | Charging approved purchases with the saved payment method (`vault_id`, `stored_credential`). **Implemented:** `src/payments/charge.ts` |
| Payments v2 – refunds | Full refunds, idempotent per payment. **Implemented:** `src/payments/refund.ts` (payments lab, SDK); the purchase history refunds through the Agent Toolkit (next row) |
| Agent Toolkit (`@paypal/agent-toolkit`) | Tools for the agent, wrapped by Leash's permission layer ("leashed tools"). **Implemented:** `check_purchase_status` reads one of the user's own purchases with the toolkit's `get_order` and checks it against Leash's records (`src/paypal/agent-toolkit.ts`, `src/agent/leashed-tools.ts`). **Implemented:** refunds with the toolkit's `create_refund` on `/history`, only when the user asks: their own charged purchase, inside its 14-day return window, in full, with a `PayPal-Request-Id` per payment so it never refunds twice (`src/purchases/history.ts`, D-037). The agent never gets a refund tool |

Customer-initiated charges carry PayPal **FraudNet** risk data (`src/components/fraudnet.tsx`, `PayPal-Client-Metadata-Id`).

Failed payments are recorded with PayPal's issue code and `debug_id`, and the user sees a plain
explanation (`src/payments/messages.ts`). A declined payment (`INSTRUMENT_DECLINED`) can be
reproduced with PayPal sandbox negative testing (`PayPal-Mock-Response`).

PayPal calls use the official **PayPal Server SDK** (`@paypal/paypal-server-sdk`, generated by
APIMatic), configured in `src/paypal/sdk.ts`. It was built with the **APIMatic Context Plugin for
PayPal** in Claude Code.

## Planned AI usage

| Model | Used for |
|---|---|
| Claude `claude-sonnet-5-5` (Anthropic API) | Shopping agent: searches and compares products, proposes purchases |
| Claude `claude-haiku-5-5` (Anthropic API) | Rule conversion (plain language → JSON) and summaries |

The AI never receives a tool that moves money, never sees credentials or tokens, and treats
product text as data, never as instructions. During early development, a free Gemini model
is used with invented data only. The public demo always uses Claude. The provider and models
are chosen in one place: `src/ai/models.ts`.

## Sponsor tools

- **Channel3:** product catalog search for the agent, through its REST API (Spain + EUR).
  **Implemented:** `src/catalog/` (search, free price re-read, cache and monthly cap). The
  agent's searches stay inside the user's allowed categories and price limit
  (`filters.category_ids` and `filters.price`), so it finds real offers the rules can allow,
  and `/agent` marks each purchase as a "Channel3 offer" or a "Demo shop" (D-035). Every
  search also includes a small Leash demo catalog with invented shops and no brands, which
  keeps the demo cases (a blocked shop, an approval, a wrong category, the trap product).
- **Render:** hosting for the public demo.
- **APIMatic:** the PayPal Server SDK, built with the APIMatic Context Plugin for PayPal.

## Setup

_Coming in phase F0/F5:_ requirements, environment variables (see
[`.env.example`](.env.example)), installation, running locally, sandbox test credentials,
and how to test each user story.

## Project docs

- [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md): full product specification
- [docs/ROADMAP.md](docs/ROADMAP.md): phases and tasks
- [docs/DECISIONS.md](docs/DECISIONS.md): technical decisions and why
- [docs/PROGRESS.md](docs/PROGRESS.md): what was done in each session
- [docs/HACKATHON_RULES.md](docs/HACKATHON_RULES.md): official rules and compliance checklist

## License

[MIT](LICENSE)
