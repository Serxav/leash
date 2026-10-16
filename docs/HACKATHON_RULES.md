# Hackathon rules – what they mean for Leash

Official rules: https://paypalaihackathon.devpost.com/rules (checked in full on
**Oct 15, 2026**). **The official rules always win** over this file, the project brief or
the Devpost form. If a term looks ambiguous, the rules require a written request for
clarification to Devpost **before the deadline**.

## Dates

| What | Official time (PT) | Madrid |
|---|---|---|
| Submission period | Oct 1, 2026 9:15 am → **Nov 12, 2026 12:00 pm** | Nov 12, **21:00** |
| Judging period | Dec 1, 2026 2:00 pm → **Dec 15, 2026 8:00 am** | Dec 15, **17:00** |
| Winners announced | On or around Dec 21, 2026 2:00 pm | Dec 21, 23:00 |

Our internal deadline is to submit on **Nov 11**, with the feature freeze on **Nov 8**.

## Section 1b of the brief (our checklist)

- **New project.** Created from scratch during the submission period (repo created
  Oct 15, 2026). All code is original. Open source code only with a compatible licence,
  building something of our own on top, and credited in the README.
- **PayPal at the centre.** PayPal is central and used in **sandbox**. The AI provider is
  free to choose.
- **Stage one is pass/fail.** The project must "reasonably fit the theme" and "reasonably
  apply the required APIs/SDKs". PayPal usage must be impossible to miss in the README, the
  description and the video.
- **AI-driven analysis.** Judging may use automated AI-driven analysis. README and
  description must name explicitly: which PayPal APIs, which AI models, and where each part
  lives in the code.
- **Judging without the demo.** Judges may score only from the text, images and video.
- **Functionality.** The project must install, run consistently, and function as depicted
  in the video and the description.
- **Platform.** Web app for desktop and mobile; state this in the submission.
- **Test access.** Free, unrestricted access until the end of judging (Dec 15, 8:00 am PT).
  The Render demo and sandbox accounts must stay alive until then.
- **README.** Complete setup and run instructions, plus test credentials or sandbox logins
  and how to get any special access.
- **Repository.** Public repository with an open source licence detectable in the About
  section (MIT).
- **Video.** Under 3 minutes (judges may stop at 3:00), public on YouTube, showing the app
  running on the real device. No third-party trademarks, copyrighted music or other material
  without permission.
- **Language.** All submission material in English, or with English translations of
  everything submitted.
- **Integrations.** Third-party SDKs, APIs and data (Channel3, Anthropic, Google, Render)
  used according to their terms.
- **Funding.** The project must not have financial or preferential support from PayPal or
  Devpost.
- **Changes after the deadline.** Drafts can be saved before the deadline. After it, the
  submission cannot be changed.
- **Winner verification.** Identity, qualifications and **role in the creation** are
  verified. Sergi must be able to explain every part, which is why `docs/DECISIONS.md`
  exists.

## Eligibility

- Individuals at the age of majority where they live (18 in Spain), at the time of entry.
- Excluded countries include Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea and
  OFAC-sanctioned countries. **Spain is not excluded.**

## Judging

- **Stage one:** pass/fail on theme fit and use of the required APIs/SDKs.
- **Stage two:** five equally weighted criteria. Ties are broken by the first criterion,
  then the next, and so on.

1. **Technological implementation**, the **tie-breaker**: how thoroughly and skilfully the
   project uses the PayPal Developer Platform and AI; a working, non-trivial implementation.
2. **Design:** a complete, coherent product experience, not just a proof of concept.
3. **Potential impact:** a credible, specific case for a real problem and a real audience.
4. **Innovation / idea.**
5. **Presentation:** the video shows the project working end to end, and the pitch explains
   the problem, who it is for and why it matters.

## Prizes

**Grand prizes:** 1st $12,000 · 2nd $8,000 · 3rd $5,000.

**Honorable mentions ($5,000 each):**
- Most Creative
- Most Impactful
- Best Demo Delivery
- Best Use of PayPal + AI
- **Best Use of Agentic Commerce** ← our main target

**Sponsor prizes.** Only these five sponsors have prizes:

| Sponsor | Prizes | Requirement |
|---|---|---|
| **AG Grid** | 1st $5,000 · 2nd $2,000 · 3rd $1,000 (×3) | Use any AG Grid tools |
| **APIMatic** | $1,000 + 6 months of a business subscription (×3) | Use any APIMatic tools |
| **Bryntum** | $1,000 (×3) | Use any Bryntum tools |
| **Channel3** | $1,500 (×1) | Use any Channel3 tools |
| **Render** | $1,000 / $750 / $500 in Render credits | Use any Render tools |

The other listed sponsor tools (Astropods, Elastic, KERNEL, Postman, Zapier) can be used but
have **no prize of their own**.

**Multiple prizes.** A project can win at most **one Grand Prize + one Sponsor Prize**, or
**one Honorable Mention + one Sponsor Prize**. The FAQ adds that a project using several
sponsor tools is considered for each of their prizes, but still wins at most one.

## Sponsor detail pages (read on Oct 16, 2026)

Each sponsor has its own page on the hackathon site. They add requirements and perks that
are not in the official rules, so read them before using a sponsor tool.

**Channel3** (https://paypalaihackathon.devpost.com/details/channel3):
- "Your project may use the Channel3 API or our MCP server as a meaningful part of the
  product experience — search, product enrichment or recommendations." Projects that only
  mention Channel3 without calling it do not qualify. **Leash calls the REST API on every
  agent search and re-reads every Channel3 product before deciding (D-028, D-029), so it
  qualifies.** The SDK is not required.
- The prize is "Best Use of Channel3", and a Channel3 founding engineer is a judge: the
  demo and video should show real Channel3 offers, not only the demo catalog.
- A hackathon key gets **20,000 free credits** with promo code `PAYPAL-HACKATHON-2026`, no
  credit card required. If credits run out, the key stays active and the Channel3 team tops
  it up on Discord (#channel3).

**APIMatic** (https://paypalaihackathon.devpost.com/details/apimatic):
- Participants who used the APIMatic Context Plugin to build their PayPal integration can
  claim 1 month of APIMatic Basic for free; winners that used it get 6 months of Business.
  Leash built its PayPal code with the plugin (D-016). The claim form is linked on that page
  (ROADMAP F6).
- The page names Claude Code as a coding tool the plugin is made for: AI coding assistants
  are expected in this hackathon. Sergi must still be able to explain every part
  (winner verification), which is why `docs/DECISIONS.md` exists.

**FAQ** (https://paypalaihackathon.devpost.com/details/faqs): nothing else that affects Leash.

## Rule-compliance checklist (tick on Nov 11)

- [ ] Public GitHub repo with the MIT licence visible in About
- [ ] README in English: what it is, AI used (Claude via the Anthropic API) and for what,
      PayPal parts used (Vault, Orders v2, refunds, Agent Toolkit) and their folders,
      requirements, variables, install and run
- [ ] Sandbox test credentials in the README and how to get any special access. The rules
      allow "test account credentials, API keys, or sandbox login details", but our API
      keys are never published (D-025): judges use the hosted demo with the sandbox
      Personal login, or their own free keys to run it locally
- [ ] `.env.example` complete, and no secret anywhere in git history
- [ ] Green CI on the last commit of `main`
- [ ] Render demo working, or instructions that work from scratch on a clean machine
- [ ] Demo and sandbox accounts alive until Dec 15, 17:00 Madrid, on a plan that never
      sleeps
- [ ] Full flow tested with the Personal and Business accounts, including
      `INSTRUMENT_DECLINED`
- [ ] The app does exactly what the video shows and the description says
- [ ] Video ≤ 2:45, public on YouTube, app running on the real device, English narration or
      subtitles, no copyrighted music, no third-party brands
- [ ] Devpost text in English: features and how it works, states it is a web app, and that
      it was built from scratch during the submission period
- [ ] Sponsor tools used are named on Devpost (Channel3, Render, and any others actually
      used), and the video shows Channel3 being called (its detail page asks for a
      "meaningful part of the product experience")
- [ ] No third-party code without a compatible licence; any used is credited in the README
- [ ] Release v1.0.0 created on GitHub, and `main` frozen until Dec 15
- [ ] Name and pitch reviewed in the form
- [ ] **Submitted**, not just saved as a draft
