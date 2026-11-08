# Architecture

Leash sits between an AI shopping agent and the user's PayPal. One rule shapes every part:
**the AI proposes, the code decides.** The model never gets a tool that moves money.

## The pieces

| Piece | What it does | Where |
|---|---|---|
| Rules builder | Meta's `muse-spark-1.3` turns plain words into exact rules, or asks what is missing. The output is checked with Zod | `src/rules/builder.ts`, `src/rules/schema.ts` |
| Rule versions | A draft becomes a rule version only when the user confirms it. Older versions stay for the history | `src/rules/policies.ts` |
| Policy engine | Plain TypeScript, no AI. Decides `APPROVE`, `NEEDS_APPROVAL` or `BLOCK`, with a one-sentence reason | `src/rules/engine.ts` |
| Rex, the agent | Searches the catalog, compares offers and calls `propose_purchase`. It may also read the status of its own orders | `src/agent/` |
| Catalog | Channel3 REST API (Spain, EUR), searched only inside the user's categories and price limit, with a 6-hour cache and a monthly cap. Demo shops add the test cases | `src/catalog/` |
| Purchases | Proposals, the approval inbox, history and refunds | `src/purchases/` |
| Payments | PayPal Vault, Orders v2 and Payments v2 through the PayPal Server SDK | `src/payments/`, `src/paypal/` |
| Security | Prompt-injection screening of shop text, the security log, AI rate limits | `src/security/` |
| Demo spaces | Every visitor gets an anonymous demo user, with Marta's rules, from a random ID in an httpOnly cookie | `src/account/`, `src/proxy.ts` |
| Pages | Home, Rex, rules, inbox, history, permissions | `src/app/` |

Data lives in SQLite through Drizzle ORM (`src/db/`). The AI provider and models are chosen
in one file, `src/ai/models.ts`.

## One purchase, start to end

1. **Rules.** The user writes "max €40 per order, €150 a month, only office supplies, ask me
   above €15". The model returns exact rules; the user reads them as a list and confirms.
2. **Search.** The user asks Rex to restock. Rex searches Channel3 only inside the confirmed
   categories and price limit. Shop text is screened by code first: a product whose text
   gives orders to AI agents is hidden from Rex and logged.
3. **Proposal.** Rex calls `propose_purchase` with a product ID, a quantity and a reason.
   Nothing else from the model is trusted.
4. **Re-read.** The server reads the price, shop and category again from the catalog.
5. **Decision.** The engine checks, in order: is the agent paused, is PayPal connected,
   hard limits (category, shop, per order, per month), then the approval amount.
6. **Outcome.**
   - `APPROVE`: PayPal Orders v2 charges at once with the vaulted PayPal.
   - `NEEDS_APPROVAL`: the purchase waits on its card and in the inbox. When the user
     approves, the server decides again with fresh data. A higher price or a rule that now
     fails blocks it.
   - `BLOCK`: stored with its reason; nothing is charged.
7. **After.** Every decision appears in the history with its rule and PayPal transaction.
   Inside the 14-day return window, the user can refund in full.

Each user's proposals and answers run one at a time, so a double click or two tabs can never
charge twice or both pass the monthly budget.

## PayPal (sandbox only)

| API | Used for | Where |
|---|---|---|
| Vault v3 (setup token → payment token, `usage_type` MERCHANT) | The mandate: the user saves PayPal once | `src/payments/mandate.ts` |
| Orders v2 (`payment_source.paypal.vault_id`, intent CAPTURE) | Charging approved purchases | `src/payments/charge.ts` |
| Payments v2 refunds | Full refunds from the history page | `src/payments/refund.ts` |
| Agent Toolkit (`sandbox: true`) | `get_order` for Rex's status checks, `create_refund` only when the user presses Refund | `src/paypal/agent-toolkit.ts`, `src/agent/leashed-tools.ts` |
| Vault delete | Disconnecting PayPal deletes the saved token at PayPal | `src/payments/mandate.ts` |

The server refuses to start unless `PAYPAL_ENVIRONMENT=SANDBOX` and the API base is
`https://api-m.sandbox.paypal.com` (`src/config/env.ts`).

## What the model may see

Rule text, public product data (title, price, shop), the engine's decision and reason, and
a short history summary. Never credentials, tokens, emails or internal PayPal IDs. AI errors
are logged only by type and HTTP status (`src/ai/errors.ts`).

## Tests

- `npm test`: unit tests, run in CI on every pull request, with stubbed PayPal and AI.
- `npm run test:sandbox`: real PayPal sandbox, Channel3 and Meta calls, run locally only.
  It covers the mandate, a charge, a declined charge (`INSTRUMENT_DECLINED`), a refund, the
  Agent Toolkit, the rules builder and the trap product.
