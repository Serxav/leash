# Try Leash: step by step for judges

Everything runs on the **PayPal sandbox**: no real money moves. Every person and shop in the
demo is invented.

**Live app:** https://leash-crcx.onrender.com

## Before you start

- **The judges' sandbox buyer account** (PayPal sandbox, Personal):
  - Email: _(added at submission)_
  - Password: _(added at submission)_
- Use this **Personal** account on PayPal's page. The demo's Business account is the shop, and
  PayPal does not let a shop pay itself (*"You are logging in to the seller's account"*). If
  your browser is already logged in to another sandbox account, log out at
  https://www.sandbox.paypal.com first.
- **Slow, not stuck.** The app runs on Render's free plan. After 15 minutes without visitors
  the first page takes about a minute to wake up, and Leash then starts every visitor with a
  fresh demo space. Rex answers in 10 to 30 seconds and shows what it is doing meanwhile.

## 1. Your demo space

Open the live app. You get your own space at once, with no sign-up: an anonymous ID in a
cookie. It starts with the sample rules of **Marta**, an invented office manager:

| Rule | Value |
|---|---|
| Each order | up to €40 |
| Each month | up to €150 |
| Ask me first | above €15 |
| What Rex may buy | only office supplies |
| Shops to avoid | marketplace-x.example |
| Units of one item | at most 5 |
| Currency | euros only, never converted |

You can see them on **Rules**.

## 2. Connect PayPal (the mandate)

**Permissions → Connect PayPal.** The button takes a few seconds on the free server. On
PayPal's sandbox page, log in with the judges' account and press **Agree and continue**. Back
in Leash, the PayPal group says **Connected**.

*What happened:* PayPal saved your PayPal for future purchases by this shop (Vault, usage type
MERCHANT). Leash stores only a reference to that token, on the server.

## 3. Ask Rex to shop

**Rex** (the chat icon) → tap *"We are out of printer paper and sticky notes, restock for the
month."*

While it works, the grey bubble says what the agent does (reading your rules, searching
Channel3 offers, Leash checking, paying with PayPal) and Rex's line says it in a dog's words.

**What you should see:**
- **Two purchases approved and charged** (green ✓ cards): paper and sticky notes, each below
  €15, so the code charges them through PayPal at once.
- Rex mentions a **cheaper offer it skipped** because it comes from marketplace-x.example, a
  shop your rules forbid.
- *"Leash hid 1 product…"*: a "sticky notes mega pack" whose shop text gives orders to AI
  agents. Plain code finds it before Rex can see it. Open **Rules & activity → Security log**
  to see it and the reasons.

## 4. One-tap approval

Type *"Our laser printer needs a new black toner cartridge."*

The toner costs €24, above Marta's €15 "ask me first" amount, so its card asks **Approve this
purchase?**. It also waits in the **Inbox**. Press **Approve €24.00** (or **Reject**).

*What happened:* approving does not skip the checks. Leash re-reads the price and runs the
engine again with the current rules and budget, and only then charges. Rejecting charges
nothing.

**Also try:** *"Get an ergonomic office chair for the new hire."* A chair costs more than €40,
the most per order, so Rex cannot buy it, and says why.

## 5. History and refunds

**History** lists every purchase Rex proposed: the decision, the rule behind it, the PayPal
transaction ID and the **14-day return window**. Press **Refund** on a charged purchase: PayPal
refunds it in full through the Agent Toolkit, once. Only you can start a refund; Rex has no
refund tool.

## 6. Your own rules

**Rules → Change your rules.** Write rules in your own words, or tap the tips (*"+ Max €40
per order."*) or an example. Press **Check my rules**:
- if something is missing, Leash asks you instead of guessing;
- otherwise you see the exact rules as a list: **Is this right?** → **Confirm these rules**.
  Nothing changes before you confirm, and each confirmation is a new version.

## 7. Stay in control

**Permissions:**
- **Pause Rex:** Leash blocks every purchase, approvals included, until you resume it.
- **Disconnect** PayPal: every charge stops and PayPal deletes the saved token.
- **Reset demo:** back to Marta's rules, no purchases, PayPal disconnected.
- **Delete my account and data:** everything Leash stores about you.

## What each colour means

| Mark | Meaning |
|---|---|
| ✓ green | Approved and charged with PayPal (sandbox) |
| ? amber | Waiting for your answer |
| ✕ red | Blocked by your rules, or rejected by you; nothing charged |
| ↩ grey | Refunded |
