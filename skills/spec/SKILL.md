---
name: spec
description: BA kit step 6 — technical specification from the reviewed backlog for the project's deploy profile (static / local / cloudflare) — architecture, data model, API or storage, UI, config, test plan, demo data — with the architect-rule re-check. Writes docs/04-spec/. Use from /ba-continue (step spec) or when the BA asks for the spec.
---

# Step 6 — technical specification

You are a solution architect writing a spec that the `build` step can implement story by story without guessing. Load `ba-rules` first and follow it — especially golden rules 2 (trace), 3 (never invent), 5 (PoC) and the architect rule (§7). Read `ba-project.yaml`.

## Gate
- `steps.review.status` is `reviewed` or `approved` (the backlog is `Reviewed`). Otherwise stop and tell the BA.
- `stack.deploy.profile` is `none` → no spec is needed for code: tell the BA, and on their OK set `steps.spec`, `steps.build`, `steps.deploy` to `skipped` (append to `approvals`). Stop.
- If `docs/04-spec/` already has files: `Draft` with open spec questions → **resume §3** from the first unanswered question; `Reviewed`/`Approved` → changes go through `/ba-sync`.

## Inputs
`docs/03-backlog/backlog.md` + `stories/US-*.md` (active stories only — not `Superseded`, not deferred), `docs/01-requirements/requirements.md`, `docs/02-analysis/analysis-log.md` (DEC, ASM, the architect-rule DEC), `ba-project.yaml` (`project.*`, `stack.*`, `repo.*`).

## 1. Architect rule re-check (before writing anything)
Run `ba-rules` §7 against the **current** rows: every agreed REQ/NFR/DEC and every active story that needs state shared between devices or users.
- Covered by the architect-rule `DEC` from step 3 (or a later one) → nothing to raise; cite the DEC in `architecture.md`.
- **Not covered** (e.g. a requirement added in step 4 or 5, or a story that goes beyond the narrowing in the DEC) → write a new `CON-xxx` tagged `Architect rule` in `analysis-log.md` (same format as step 3: positions with quotes, options `static` / `local` / `cloudflare`, `Claude's recommendation`), **stop** and let the BA decide (outcome a/b/c → `DEC-xxx`). Do not write the spec until it is decided. A profile change follows `analyze-conflicts` Part B item 7 (explicit OK, `approvals` row).

## 2. Stack per profile (the given — never go beyond it without a DEC)

| Profile | Front end | Server / storage | Time rules | Tests | Not used |
|---|---|---|---|---|---|
| `static` | Plain HTML/CSS/JS (ES modules), no framework, no build step; served from `app/public/` as is (that folder is what gets published) | None. Browser `localStorage` behind **one** storage module: versioned key `<project-slug>:v1`, JSON, try/catch on every access (private mode, quota, eviction → visible message, app still renders) | Evaluated in the browser at read / action time from one clock module (`now()`), office time zone from config | Vitest (unit, pure functions + storage module with a fake storage) · Playwright E2E against a tiny Node static server (`scripts/serve.mjs`, no dependencies) | any server, any third-party store, cookies for data |
| `local` | Same plain front end, served by the Node server | Node ≥ 22 (`node:http`, no framework) + SQLite via built-in `node:sqlite` (no native modules) — one file under `app/data/` (git-ignored); server listens on a configured port | Evaluated at read / request time on the server; no background jobs unless a story needs one and a DEC allows it | Vitest (unit + API against a temp SQLite file) · Playwright E2E with `webServer` = the Node server | cloud services, external databases |
| `cloudflare` | Same plain front end as Workers Static Assets | One TypeScript Worker (`/api/*`) + D1 (migrations in `app/migrations/`); `wrangler.toml` with `[env.production]` | At read time / first request — no Cron, no KV, no Queues unless a DEC says so | Vitest with `@cloudflare/vitest-plugin` (unit, API against local D1, a production-config project that checks test hooks are off) · Playwright E2E with `webServer` = `wrangler dev --local` | KV, Durable Objects, Cron, any VM |

All profiles:
- **One config module** is the only place that reads assumed values; the front end gets them from it (or from `GET /api/meta`).
- **One clock** with a test-only override (header, query or injected function — per profile). The override and any test-only route or reset are **off** in the deployed build (`static`: only on `localhost` / `127.0.0.1`; `local`/`cloudflare`: by an environment variable that defaults to off in production). Nothing destructive is reachable from a URL parameter of the deployed app unless a story defines a guarded demo reset.
- Phone width 375×667 and desktop, unless the requirements say otherwise.
- No real personal data; no secrets in the repo (`cloudflare`: secrets are set by the BA with `wrangler secret put`).

Write the derived constraints (profile + project DECs, e.g. "no backend", "single-device demo — DEC-014") to `stack.constraints` in `ba-project.yaml` (field owned by this step; the BA reviews it with the spec).

## 3. Output — `docs/04-spec/`
Each file starts with the golden-rule-8 header (`Generated by: spec (BA kit)`, date, inputs with `Confluence <pageId> v<N>`, `Status: Draft`).

| File | Content |
|---|---|
| `architecture.md` | Component diagram (mermaid) for the profile; flows for the main actions; code layout table for `build` (path · content · spec section); why each choice (link DEC / CST / NFR); what is **not** used and why; what anyone has to operate (target: nothing); the architect-rule DEC and its narrowing (banner, seed, single device) if any; **Open questions for the BA**; **Questions for the technical stakeholder** (named in the sources) about hosting, storage and operations — or one line "none". |
| `data-model.md` | `static`: stored JSON shape, key and version, migration on version change, reset · `local`: SQLite schema as SQL · `cloudflare`: D1 migrations as SQL. Unique rules that prevent double booking / double lending, state lifecycle of each entity, what is deleted when (retention). |
| `api.md` **or** `storage.md` | `local`/`cloudflare` → `api.md`: every endpoint — method, path, request, response, error codes and exact user messages, each error mapped to the AC that requires it; protected reseed endpoint if demo data needs one. `static` → `storage.md`: every storage operation (read / write / reset) as a function contract with the same error and message mapping; behaviour with two tabs open; storage unavailable. |
| `ui.md` | Screens and states (empty, full, error, after reload), exact texts from stories; ASCII wireframes; phone and desktop; demo switch for A/B groups; demo-only banner if the architect-rule DEC narrowed the scope. |
| `config.md` | Every assumed value as a named constant: default · type / format · source (`ASM-xxx` — `ASSUMPTION — not validated`, or `DEC-xxx`) · stories that use it. No value without a source. |
| `test-plan.md` | Test setup table (type · tool · runs against · clock · data reset); **every Gherkin scenario of every active story → test type (unit / API / E2E / manual) → test file**; smoke test for the deployed app; checks that test hooks are off in the deployed build. End with a coverage table: story → spec elements; no feature without a story, no story without a spec element. |
| `demo-data.md` | Exact seed relative to "now": per day and per resource what exists and in which state, so every Core-demo scenario and every A/B variant shows something at the demo; fictional names; how and when to reseed. |

## 4. Rules
- Every spec element names the story / REQ / DEC it serves. Do not change requirements or stories here.
- A value not in sources, DEC or ASM is not invented: it is a spec question.
- **Spec questions (decision point H5):** ambiguity, contradiction between stories, or a missing value → `OQ-Sn` in `architecture.md` "Open questions for the BA". Ask them one by one with options and `Claude's recommendation`; record each answer as `DEC-xxx` in `analysis-log.md` (section "Decisions from the spec") and, if it adds a rule, a `Proposed` row in `requirements.md` with source `[DEC-xxx]`; update affected stories with `Updated <date> by spec (DEC-xxx)`. If the BA stops midway, the spec stays `Draft`; `/ba-continue` resumes here.
- Interpretations that are not trade-offs (e.g. which HTTP code) are listed as `I-n` in `architecture.md` for the BA's review — no DEC needed.
- Keep it short: tables over prose.

## Quality bar (check before finishing; report failures)
- The architect rule was re-checked; every shared-data need is covered by a DEC.
- Every scenario of every active story is mapped to a test; every active story has a spec element.
- Every constant in `config.md` has a source; no value appears in two places.
- Nothing in the spec needs a service beyond the profile table above.

## Finish
1. `ba-project.yaml`: `steps.spec = {status: draft, source_version: <source.version>, updated: <today>}`; `stack.constraints` as above.
2. Append to `docs/run-log.md`: files, counts (endpoints or storage operations, tables, constants, scenarios mapped), spec questions asked and answered, interpretations.
3. Reply in the chat language: what was produced, open questions, interpretations to check, questions for the technical stakeholder, decision point "BA + tech review → reviewed", proposed commit `step 6: technical spec v1`. When the BA says "reviewed": set every spec file header to `Status: Reviewed (BA, <date>)`, `steps.spec.status` → `reviewed`, append to `approvals`.
