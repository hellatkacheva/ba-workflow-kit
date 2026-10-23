# ba-workflow-kit

Claude Code plugin for business analysts: a Confluence requirements page → traced requirements → decisions → backlog → spec → PoC → Jira, with BA decision points and change-impact sync. Design: [`docs/design.md`](docs/design.md) (Reviewed).

## Status — iteration 3 (v0.4.0)

| Part | State |
|---|---|
| Plugin manifest + local marketplace (`.claude-plugin/`) | done |
| Skill `ba-rules` + project templates (`skills/ba-rules/templates/project/`) | done |
| Commands `/ba-new`, `/ba-status` | done |
| Skills `ingest-confluence` (step 1), `requirements` (step 2) | done |
| Skills `analyze-conflicts` (step 3), `write-stories` (step 4), `review-backlog` (step 5) + agent `backlog-reviewer` | done (iteration 2a) |
| Skills `spec` (step 6), `build` (step 7), `deploy` (step 8, + `templates/pages.yml`), `jira-sync` (step 9) | done (iteration 2b) |
| Command `/ba-continue` | router: runs steps 1–9 up to the next BA decision point, resumes open decisions of steps 3, 5, 6 and the build story by story |
| Command `/ba-sync` + skill `change-impact` (+ `scripts/blockdiff.mjs`) | done (iteration 3): snapshot v<new>, block diff, quote trace, CHG-xxx with a row-by-row plan, scoped rework after the BA's OK, Jira via `jira-sync` |
| Agents `impact-analyst` (impact report), `trace-auditor` (trace check after rework) | done (iteration 3), read-only |
| GitHub Action `confluence-watch` (template, weekdays, no AI) | done (iteration 3): `/ba-new` installs it off; `/ba-sync setup-watch` lists the BA's steps |

Changes accepted after the design review: `docs/design.md` §11; fixes after test A (`.gitattributes`, `/ba-continue` router, requirements atomicity, §8 checklist, golden test, per-page snapshots, child-page source keys, `Derived` requirements), iteration 2a decisions, test A steps 3–5 (K-10, K-11), iteration 2b, test A steps 6–9 (K-14…K-17): §12; iteration 3: §13.

## Layout

```
.claude-plugin/   plugin.json, marketplace.json (local marketplace for testing)
commands/         ba-new, ba-status, ba-continue (router, steps 1–9), ba-sync (change impact, setup-watch)
skills/           ba-rules (+ templates/project), ingest-confluence, requirements, analyze-conflicts,
                  write-stories (each + templates), review-backlog, spec, build, deploy (+ templates), jira-sync,
                  change-impact (+ scripts/blockdiff.mjs)
agents/           backlog-reviewer, impact-analyst, trace-auditor
docs/design.md    design (Reviewed)
tests/fixtures/   test C source (GearLoan)
tests/golden/     golden topic lists (DeskShare step 2)
```

## Install locally for testing

Prerequisite in the **test project**: an Atlassian MCP server in `.mcp.json`, authenticated via `/mcp`:

```json
{ "mcpServers": { "atlassian-olga": { "type": "http", "url": "https://mcp.atlassian.com/v1/mcp" } } }
```

**Option 1 — one session, no install** (good while developing the kit):

```
cd <test-project>
claude --plugin-dir C:\Projects\ba-workflow-kit
```

**Option 2 — install from the local marketplace** (persists; reload after kit changes):

```
claude plugin marketplace add C:\Projects\ba-workflow-kit
claude plugin install ba-workflow-kit@ba-workflow-kit
```

After kit changes: `claude plugin marketplace update ba-workflow-kit` and `claude plugin update ba-workflow-kit@ba-workflow-kit`, then restart the session.

Check: `claude plugin validate C:\Projects\ba-workflow-kit`; in a session `/help` lists `/ba-new` and `/ba-status` (plugin commands can also be called as `/ba-workflow-kit:ba-new`).

## First run (test A)

```
/ba-new https://hellatkacheva.atlassian.net/wiki/spaces/DSSRC/pages/65670 --jira KAN
/ba-status
```

Then `/ba-continue` — runs `requirements` and stops for the BA review (H1); compare the result with `tests/golden/deskshare-step2.md`. After each "reviewed", `/ba-continue` again: step 3 (conflicts — overview table, then the BA decides each CON incl. the architect rule), step 4 (stories), step 5 (independent review), step 6 (spec), step 7 (build, one story per run), step 8 (deploy after an explicit OK), step 9 (Jira after an OK on the plan).

## Source changed (test B)

```
/ba-status        # Confluence newer than source.version?
/ba-sync          # snapshot + CHG-xxx report → stops for the BA's OK → scoped rework → trace check
/ba-sync setup-watch   # weekday GitHub Action (secrets typed by the BA)
```

The test plan with the page edits per scenario: `docs/design.md` §8.1.
