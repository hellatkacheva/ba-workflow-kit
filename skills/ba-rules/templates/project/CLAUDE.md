# {{PROJECT_NAME}} — project rules for Claude

This project runs on the **BA workflow kit** (Claude Code plugin `ba-workflow-kit`). Settings: `ba-project.yaml`. Shared rules: skill `ba-rules` (golden rules, decision rules, IDs, BA decision points, actions Claude never takes) — load it before any step.

## Project

| | |
|---|---|
| **Source** | Confluence `{{SITE}}` · space `{{SPACE_KEY}}` · page `{{PAGE_ID}}` — "{{PAGE_TITLE}}" |
| **Jira** | project `{{JIRA_KEY}}` |
| **BA** | {{BA_NAME}} |
| **Deploy profile** | see `ba-project.yaml` → `stack.deploy.profile` |
| **Start here** | `docs/00-source/` — the only inputs (read-only). `docs/run-log.md` — what ran when. |

## Commands

| Command | What it does |
|---|---|
| `/ba-status` | Read-only overview: steps, source version (local vs Confluence), open conflicts and gaps |
| `/ba-continue` | Run the next step up to the next BA decision point |
| `/ba-sync` | Source page changed → change report `CHG-xxx` → rework only what is affected, after the BA's OK |

## Project-specific notes

<!-- The BA adds project rules here (stakeholder names, glossary, anything the kit does not know). -->
