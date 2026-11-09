# Devpost submission – draft

Everything here must match what the app really does. Fill in the _(…)_ parts at submission
and read every line once more against the live app.

## Basics

- **Name:** Leash – Spending rules for AI agents
- **Tagline:** Give your AI agent a budget, not your wallet. Plain-language spending rules,
  one-tap human approval and PayPal checkout.
- **Platform:** web application for desktop and mobile
- **Built:** from scratch during the submission period (repository created Oct 15, 2026)
- **Repository:** https://github.com/Serxav/leash (MIT)
- **Demo URL:** https://leash-51ew.onrender.com
- **Video:** https://youtu.be/U66DzesEET8 (2:42; AI narration with Kokoro text-to-speech, music generated in code)
- **Prize categories:** Best Use of Agentic Commerce (or Best Use of PayPal + AI). Sponsor
  tools used: Channel3, Render, APIMatic.
- **Built with:** Next.js, TypeScript, Tailwind CSS, SQLite, Drizzle ORM, Vercel AI SDK, Meta
  Model API (Muse Spark), PayPal Server SDK, PayPal Agent Toolkit, Channel3, Render, Vitest.

## Inspiration

AI agents can already find and compare what an office needs, but nobody lets them pay. You
can't tell an agent "spend at most €150 a month, only on office supplies, and ask me above
€15", and trust that it will listen. In Europe, PSD2 also says the person must authorise
payments. We wanted the missing piece: a leash between the agent and the money.

## What it does

Leash is a control layer between an AI shopping agent and your PayPal.

1. **You write spending rules in plain words.** An AI (Meta's Muse Spark) turns them into
   exact rules; you read them as a list and confirm. Nothing applies before that, and when
   something is missing, Leash asks instead of guessing.
2. **Rex, the AI shopping agent, shops.** It searches real offers through Channel3, only
   inside your categories and price limit, compares them and proposes purchases.
3. **Code decides, not the AI.** Every proposal goes through a policy engine in plain
   TypeScript, with no AI: approve (PayPal charges at once with your saved PayPal), ask you
   first, or block, always with a one-sentence reason.
4. **One tap.** Purchases above your amount wait on their card and in the inbox. Approving
   re-checks the price and your rules before PayPal charges.
5. **History and refunds.** Every decision with its rule and PayPal transaction ID, a 14-day
   return window and a refund button that only you can press.
6. **You stay in control.** Pause the agent, disconnect PayPal (the saved token is deleted at
   PayPal), reset the demo or delete your data.
7. **Visible security.** A product whose shop text gives orders to AI agents is caught by
   plain code, hidden from the agent, never bought and logged.

## How we built it

- **PayPal (sandbox only):** Vault to save PayPal once as the mandate (`src/payments/mandate.ts`),
  Orders v2 to charge with the vaulted token (`src/payments/charge.ts`), Payments v2 refunds
  (`src/payments/refund.ts`), and the PayPal Agent Toolkit wrapped in "leashed tools": the agent
  may check its own orders with `get_order`, and `create_refund` runs only when the user asks
  (`src/agent/leashed-tools.ts`). All calls use
  the official PayPal Server SDK, built with the APIMatic Context Plugin for PayPal.
- **AI:** Meta `muse-spark-1.3` through the Meta Model API (Standard mode, no training on our
  requests), via the Vercel AI SDK (`src/ai/models.ts`), for the agent (`src/agent/agent.ts`)
  and the rules converter (`src/rules/builder.ts`). Its only purchase tool is
  `propose_purchase`; the server re-reads price and shop and runs the engine itself.
- **Policy engine:** plain TypeScript with unit tests (`src/rules/engine.ts`), versioned rules
  (`src/rules/policies.ts`).
- **Channel3:** product search through its REST API, Spain and EUR, filtered by the user's
  categories and price, with a 6-hour cache and a monthly cap (`src/catalog/`).
- **Render:** the live demo, from a Blueprint (`render.yaml`).
- **App:** Next.js 16 and TypeScript, Tailwind CSS, SQLite with Drizzle, Vitest (546 unit
  tests in CI, plus real sandbox tests run locally).

## Challenges we ran into

- **Letting an AI shop without letting it pay.** The agent never gets a tool that moves money,
  and the server never trusts the agent's prices: it re-reads them from the catalog before
  deciding.
- **Prompt injection from shop text.** Product descriptions are untrusted. Plain code screens
  them for instructions aimed at AI agents before the model sees them.
- **Approvals that can't go stale.** An approval made hours later re-checks the price, the
  rules and the monthly budget before charging.
- **A free, public demo.** Each visitor gets an anonymous demo space, AI calls are
  rate-limited, and the server refuses to start with anything but the PayPal sandbox.

## Accomplishments that we're proud of

- The full loop works end to end in the PayPal sandbox: mandate, automatic charge, one-tap
  approval, refund and revocation.
- "The AI proposes, the code decides" holds everywhere, and is tested.
- A friendly product: Rex, an original mascot, a chat that shows what the agent is doing, and
  rules that read like settings.

## What we learned

_(Sergi, in your own words: what you learned about PayPal's Vault and Orders, about agents and
prompt injection, and about building a full product in four weeks.)_

## What's next for Leash

Team roles and shared budgets, an open "leashed tools" library for the PayPal Agent Toolkit,
and live payments only after PayPal validation and a legal review (GDPR, PSD2).

Real shops and delivery. Today the demo pays a sandbox demo store and collects no address
(`NO_SHIPPING`). With real shops, Leash would pay each shop directly through PayPal Orders v2,
with the buyer's shipping address from their PayPal account, so they need no account at the
shop. A shop that does not accept PayPal or cannot deliver there is blocked or asked about,
never guessed. The AI still never sees the address.

## Testing instructions for judges

- Live app: https://leash-51ew.onrender.com (free plan: the first visit after 15 quiet
  minutes takes about a minute).
- PayPal sandbox buyer account: `leash-judges@personal.example.com` / _(password: paste it
  here in the Devpost form only, never in the repository)_. Use this Personal account on
  PayPal's page.
- Step by step: https://github.com/Serxav/leash/blob/main/docs/TRY_IT.md
- Run it locally: README → "Run it locally".
