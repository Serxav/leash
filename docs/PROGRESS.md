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

**Left**
- `chore/setup-ci`, the ruleset status check, `feat/f0-sandbox-connection`, and the Agent
  Toolkit and Channel3 spikes.

**Blockers**
- None.
