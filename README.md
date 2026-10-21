# ba-workflow-kit

Claude Code plugin for business analysts: a Confluence requirements page → traced requirements → decisions → backlog → spec → PoC → Jira, with BA decision points and change-impact sync. Design: [`docs/design.md`](docs/design.md) (Reviewed).

## Status — iteration 2a (v0.2.0)

| Part | State |
|---|---|
| Plugin manifest + local marketplace (`.claude-plugin/`) | done |
| Skill `ba-rules` + project templates (`skills/ba-rules/templates/project/`) | done |
| Commands `/ba-new`, `/ba-status` | done |
| Skills `ingest-confluence` (step 1), `requirements` (step 2) | done |
| Skills `analyze-conflicts` (step 3), `write-stories` (step 4), `review-backlog` (step 5) + agent `backlog-reviewer` | done (iteration 2a) |
| Command `/ba-continue` | router: runs implemented steps (1–5) up to the next BA decision point, resumes open decisions of steps 3 and 5; steps 6–9 → "iteration 2b" |
| Command `/ba-sync` | stub (TODO) |
| Skills `spec`, `build`, `deploy`, `jira-sync` | stub (iteration 2b) |
| Skill `change-impact` | stub (iteration 3) |
| Agents `impact-analyst`, `trace-auditor` | stub (iteration 3) |
| GitHub Action `confluence-watch` | not started (iteration 3) |

Changes accepted after the design review: `docs/design.md` §11; fixes after test A (`.gitattributes`, `/ba-continue` router, requirements atomicity, §8 checklist, golden test, per-page snapshots, child-page source keys, `Derived` requirements) and iteration 2a decisions: §12.

## Layout

```
.claude-plugin/   plugin.json, marketplace.json (local marketplace for testing)
commands/         ba-new, ba-status, ba-continue (router, steps 1–5), ba-sync (stub)
skills/           ba-rules (+ templates/project), ingest-confluence, requirements, analyze-conflicts,
                  write-stories (each + templates), review-backlog, stubs (spec, build, deploy, jira-sync, change-impact)
agents/           backlog-reviewer; stubs (impact-analyst, trace-auditor)
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

Then `/ba-continue` — runs `requirements` and stops for the BA review (H1); compare the result with `tests/golden/deskshare-step2.md`. After each "reviewed", `/ba-continue` again: step 3 (conflicts, BA decides each CON incl. the architect rule), step 4 (stories), step 5 (independent review).
