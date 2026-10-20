# ba-workflow-kit

Claude Code plugin for business analysts: a Confluence requirements page → traced requirements → decisions → backlog → spec → PoC → Jira, with BA decision points and change-impact sync. Design: [`docs/design.md`](docs/design.md) (Reviewed).

## Status — iteration 1 (v0.1.0)

| Part | State |
|---|---|
| Plugin manifest + local marketplace (`.claude-plugin/`) | done |
| Skill `ba-rules` + project templates (`skills/ba-rules/templates/project/`) | done |
| Commands `/ba-new`, `/ba-status` | done |
| Skills `ingest-confluence` (step 1), `requirements` (step 2) | done |
| Commands `/ba-continue`, `/ba-sync` | stub (TODO) |
| Skills `analyze-conflicts`, `write-stories`, `review-backlog`, `spec`, `build`, `deploy`, `jira-sync`, `change-impact` | stub (TODO) |
| Agents `backlog-reviewer`, `impact-analyst`, `trace-auditor` | stub (TODO) |
| GitHub Action `confluence-watch` | not started (iteration 3) |

Changes accepted after the design review (skill names, template location, Jira status IDs filled by `jira-sync`): see `docs/design.md` §11.

## Layout

```
.claude-plugin/   plugin.json, marketplace.json (local marketplace for testing)
commands/         ba-new, ba-status, ba-continue (stub), ba-sync (stub)
skills/           ba-rules (+ templates/project), ingest-confluence, requirements (+ templates), stubs
agents/           stubs
docs/design.md    design (Reviewed)
tests/fixtures/   test C source (GearLoan)
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

Then the `requirements` skill ("извлеки требования") — `/ba-continue` arrives in iteration 2.
