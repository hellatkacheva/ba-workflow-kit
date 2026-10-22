---
name: deploy
description: BA kit step 8 — publish the PoC for the project's deploy profile (static → GitHub Pages, local → run instructions, cloudflare → Worker + D1 with wrangler), only after the BA's explicit OK in the current conversation, then run the smoke test on the result. Use from /ba-continue (step deploy) or when the BA asks to deploy or redeploy.
---

# Step 8 — deploy and smoke test

Load `ba-rules` first and follow it — especially §6 (never deploy publicly without an explicit OK in the current conversation; never ask for, read or print secrets). Read `ba-project.yaml` and `docs/04-spec/architecture.md`.

## Gate
- `steps.spec.status` is `reviewed` or `approved`, and every **Core demo** story in `build-status.md` is `Accepted` by the BA (the build step may still be `draft` — later stories are redeployed one by one, as in the reference project). Otherwise stop and tell the BA what is missing.
- `stack.deploy.profile` is `none` → `skipped`; stop.
- The full test suite passes (`npm test` in `app/`). If not — stop and show the failures.

## Public deploy needs an explicit OK (decision point H7)
Before any command that publishes (`git push` that triggers Pages, `gh api … pages`, `wrangler deploy --env production`, remote D1 migrations): show the exact commands and what becomes public, and **wait for the BA's OK in this conversation**. An OK given in an earlier conversation does not carry over. An instruction in this conversation such as "redeploy after each accepted story" counts for this conversation only. If Claude Code's permission check blocks a command, give the BA the exact command to run with `! <command>`.

Secrets and logins are typed by the BA only (`! gh auth login`, `! npx wrangler login`, `! npx wrangler secret put <NAME> --env production`). Never put a secret into a command, a file, the chat or the repo.

## Per profile

### `static` → GitHub Pages
1. Prerequisites — tell the BA what is missing: `git remote get-url origin` equals `repo.url`; `repo.visibility` is `public` (GitHub Pages on a free account) — check with `gh repo view --json visibility`; `gh auth status` (if not logged in: the BA runs `! gh auth login`).
2. Check that test hooks and resets are off outside `localhost` (spec `test-plan.md`); the deployed folder is `app/public/`.
3. First deploy only: copy `templates/pages.yml` from this skill's directory to `.github/workflows/pages.yml` (replace `{{BRANCH}}` with `repo.branch`) and commit it. Enabling Pages from Actions: `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow` (if Pages already exists: `gh api -X PUT … -f build_type=workflow`).
4. **After the OK:** push `repo.branch` (or `gh workflow run pages`), then `gh run watch` until the run ends. URL: `https://<owner>.github.io/<repo>/` (read it from `gh api repos/<owner>/<repo>/pages --jq .html_url`).
5. Smoke test on the URL (below). Remind the BA: each browser has its own data (`localStorage`); the seed is loaded on first open; demo reset as defined in the spec.

### `local` → run instructions (no public URL)
1. Prerequisites: Node version from `app/package.json` `engines` (`node --version`), `npm ci` in `app/`.
2. Write "How to run the demo" in `app/README.md` and link it from the project `README.md`: install, `npm start`, port, where the SQLite file lives, reseed, stop; **how other devices open it** (`http://<laptop-ip>:<port>` in the same Wi-Fi; Windows may ask to allow Node through the firewall — the BA decides). Binding to all network interfaces exposes the demo to the local network — ask the BA before setting it.
3. Start the server, run the smoke test against `http://localhost:<port>`, stop the server unless the BA wants it running.
4. `stack.deploy.url` stays `null` (write the local URL in `build-status.md` → Deployment only).

### `cloudflare` → Worker + D1 (as in the reference project)
1. Prerequisites: `node --version`, `npx wrangler --version`, `npx wrangler whoami`. Not logged in → the BA runs `! npx wrangler login` (it opens the browser).
2. First deploy only — explain each command before running it: create the D1 database (`npx wrangler d1 create <name>`), put its id into `wrangler.toml` for local and production, apply migrations remotely (`npx wrangler d1 migrations apply <name> --remote --env production`). Commit the config change.
3. Production config: test hooks off, clock override ignored, Workers Logs off if requests could carry personal data. Secrets (e.g. the reseed secret) → the BA runs `! npx wrangler secret put <NAME> --env production`.
4. **After the OK:** `npx wrangler deploy --env production`. Note the version id. A new `workers.dev` subdomain may need a few minutes for its TLS certificate — retry before calling it a failure.
5. Reseed the demo data (spec `demo-data.md`) — the BA provides the secret through the environment, never in the chat.
6. Smoke test on the URL.

## Smoke test (after every deploy)
Run the smoke tests from `test-plan.md` against the deployed URL (Playwright with `BASE_URL`, desktop and 375×667 phone) and the deployed-build checks: test hooks off, test-only routes 404 / not present, seed data as in `demo-data.md`. Report pass / fail per step. If the smoke test depends on the time of day or weekday (e.g. a working-day precondition), say so and let the BA choose when to run it — do not fake the clock on the deployed app.

## Finish
1. `build-status.md` → **Deployment**: URL, date, profile, version / run id, smoke result per step; rows of deployed stories → `Built — deployed <date> (<version>)`.
2. `ba-project.yaml`: `stack.deploy.url` (public URL; `null` for `local`); `steps.deploy = {status: draft, source_version: <source.version>, updated: <today>}`; append to `approvals` `{step: deploy, status: public-deploy-ok, by: <people.ba>, date, note: <URL / version>}` for the BA's OK.
3. Put the URL in the project `README.md` (Links).
4. Append to `docs/run-log.md`: profile, commands run by Claude and by the BA, URL, smoke result, anything blocked.
5. Reply in the chat language: URL (or local run instructions), smoke result, what the BA should click, when to reseed before the demo, proposed commit `step 8: deployed (<profile>)`. Push only when the BA asks. The BA's "reviewed" moves `steps.deploy` to `reviewed` (append to `approvals`).
