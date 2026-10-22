---
name: build
description: BA kit step 7 — build the PoC one story at a time, tests first, on the stack of the project's deploy profile (static — HTML/JS + localStorage, local — Node + SQLite, cloudflare — Worker + D1); the BA accepts each story before the next. Writes app/ and docs/04-spec/build-status.md. Use from /ba-continue (step build) or when the BA asks to build a story (argument US-xxx).
---

# Step 7 — build, one story at a time

You are the developer. Load `ba-rules` first and follow it — especially golden rules 3 (never invent) and 5 (PoC, no gold-plating). Read `ba-project.yaml`. Code lives in `app/`.

## Gate
- `steps.spec.status` is `reviewed` or `approved`. Otherwise stop and tell the BA.
- `stack.deploy.profile` is `none` → this step is `skipped` (see `spec`); stop.
- The last built story in `build-status.md` is not yet accepted by the BA → do not start a new one: show what is waiting for acceptance and how to check it, and stop. The BA's "accepted" / "next story" / "continue" counts as acceptance.

## Which story
- With an argument (`US-xxx`): that story — it must be active (not `Superseded`, not deferred).
- Otherwise: the next story not yet built in the cut-line order of `backlog.md` (Core demo → Next → Drop first), unless the BA set another order in this conversation or in `build-status.md`.
- All stories of the bands the BA wants are built and accepted → do not build more; ask the BA whether the build is `reviewed` (see Finish).

## First run — scaffold `app/` for the profile (`spec/architecture.md` code layout wins where it is more specific)

| Profile | Scaffold | Scripts |
|---|---|---|
| `static` | `public/` = the published site: `index.html`, `app.js`, `styles.css`, `public/src/` (config, clock, rules, storage, seed data — the browser loads the seed); `scripts/serve.mjs` (Node static server, no dependencies), `test/unit/`, `e2e/` | `npm test` (Vitest + Playwright, local server), `npm run dev` (`node scripts/serve.mjs`) |
| `local` | `server.mjs` (`node:http`), `src/` (config, clock, rules, db with `node:sqlite`), `public/`, `migrations/`, `seed/`, `data/` (git-ignored), `test/unit/`, `test/api/`, `e2e/` | `npm start`, `npm run dev`, `npm test`, `npm run reseed` |
| `cloudflare` | `wrangler.toml` (assets dir, D1 binding, `[vars]` with test hooks on, `[env.production]` with test hooks off, `send_metrics = false`), `src/worker.ts` + config, clock, rules, db, `migrations/0001_init.sql`, `public/`, `seed/`, `scripts/reseed.mjs`, `test/unit/`, `test/api/`, `e2e/` | `npm run dev` (`wrangler d1 migrations apply --local` + `wrangler dev --local` — no Cloudflare login needed), `npm test`, `npm run reseed`, `npm run test:smoke` |

Also: `package.json` with pinned dev dependencies installed locally only (`npm install`; never global), Playwright browsers on first E2E run, `app/README.md` for developers (how to run, test, reseed — with Windows PowerShell notes: `npm.cmd` if script execution is blocked), project `.gitignore` already covers `node_modules/`, `.wrangler/`, `*.sqlite`, test reports. Commit the scaffold with the first story.

## For each story
1. Read the story and the spec parts it maps to (`test-plan.md` §2). Say in the chat language, in 3 lines, what you will build.
2. **Tests first:** turn every Gherkin scenario of the story into an automated test as mapped in `test-plan.md` (use the test clock for time rules). Run them — they must fail for the right reason. A scenario that needs a later story is marked in `build-status.md` with the story it waits for (never silently skipped).
3. Implement the minimum to make them pass. Only constants from the config module — no magic numbers, no texts that differ from the story / `ui.md`.
4. Run the **full** test suite. Everything must pass before you continue.
5. Update `docs/04-spec/build-status.md` (format below) and the AC → test coverage in `test-plan.md`.
6. Commit `build US-xxx: <title>` when the BA agrees (or has said to commit after each story in this conversation). Do not push unless the BA asks.
7. Report in the chat language: what works now, **how the BA checks it** (`npm run dev` + local URL, which clicks, on phone width too), test counts, any deviation or interpretation (`B-n`). **Stop** — decision point H6: the BA accepts the story or asks for changes.

## Rules
- Never change requirements, stories or the spec silently. Ambiguous, contradictory or impossible → stop, explain in the chat language, give options with `Claude's recommendation`, wait for the BA. Record the answer as `B-n` in `build-status.md` and, if it decides a trade-off or changes behaviour, as `DEC-xxx` in `analysis-log.md` (section "Decisions during build").
- Nothing beyond the story and the profile (no extra services, no third-party stores, no features "while we are here").
- No real personal data; no secrets in the repo or in the chat. Test hooks stay off in the deployed configuration.
- One story per run unless the BA says "continue"; the BA checks each story.
- After an accepted story, a redeploy happens only through the `deploy` step with the BA's OK.

## `docs/04-spec/build-status.md`
Header (golden rule 8, `Generated by: build (BA kit)`, `Status: Draft — updated after every story`), then:

| # | Story | Band | Status | Tests | Commit | BA | Notes |
|---|---|---|---|---|---|---|---|

Status: `Built (local)` · `Built — deployed <date> (<version or URL>)`. BA: `Accepted (BA, <date>)` · `Changes requested — <what>` · empty while waiting. Notes: `B-n` items, scenarios waiting for another story. Below the table: section `B-n` (question · options · BA answer · DEC) and section **Deployment** (filled by `deploy`).

## Finish
1. `ba-project.yaml`: after the first story `steps.build = {status: draft, source_version: <source.version>, updated: <today>}`; update `updated` after each story.
2. Append to `docs/run-log.md` per story: story, scenarios automated / waiting, test counts, `B-n`, what the BA accepted or asked to change.
3. When every story the BA wants is built and accepted, ask whether the build is reviewed. On the BA's "reviewed": `steps.build.status` → `reviewed`, append to `approvals`. Next step: `deploy` (for a first public deploy it may run earlier — see `deploy` gate).
