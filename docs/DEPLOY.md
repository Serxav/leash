# Deploy

The live demo runs on **Render Free** from the Blueprint in [`render.yaml`](../render.yaml):
https://leash-crcx.onrender.com

## How it runs

- Region Frankfurt (EU), branch `main`, deployed only after the GitHub checks pass.
- `npm ci && npm run build`, then `npm start`. Node comes from `.nvmrc` (24).
- Health check: `/api/health` answers `{ "status": "ok" }` and nothing else.
- Free plan: it sleeps after 15 minutes without visits and wakes in about a minute.
- No persistent disk: the SQLite database is created again on every start. Each visitor gets
  a fresh demo space, so nothing depends on old data.

## Variables

Set them in the Render dashboard only. Every one except `PAYPAL_ENVIRONMENT` has
`sync: false`, so no value is ever in the repository.

| Variable | Value |
|---|---|
| `PAYPAL_ENVIRONMENT` | `SANDBOX` (set by the Blueprint; anything else is refused) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | The PayPal sandbox REST app |
| `AI_PROVIDER` | `meta` (set by the Blueprint) |
| `META_MODEL_API_KEY` | The Meta Model API key |
| `CHANNEL3_API_KEY` | Optional. Without it, only the demo shops |
| `APP_URL` | Optional. Render's own address is used otherwise |

PayPal's return URL is built from `APP_URL` or Render's `RENDER_EXTERNAL_URL`, never from the
request's Host header.

## Limits on a public server

- AI calls: 10 agent runs and 20 rule conversions per visitor per hour, 100 and 200 in total.
- Channel3: 6-hour search cache and 2,000 searches a month at most.
- Demo spaces not visited for 7 days are deleted with their saved PayPal.

## Before judging (Dec 1–15)

1. Open `/api/health` and the home page.
2. Connect PayPal with the judges' sandbox Personal account, run Rex once, approve one
   purchase, refund it.
3. Check the PayPal sandbox Business account received and refunded the payment.
4. If the AI fails, read Render's log for the line `[agent] AI call failed:`. It names only
   the error type and HTTP status.
