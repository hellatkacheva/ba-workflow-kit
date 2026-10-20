---
description: Read-only overview of a BA kit project — steps and approvals, source version local vs Confluence, open conflicts, gaps and change reports
---

Load the `ba-rules` skill first. This command is **read-only**: no file writes, no git commands that change anything, only read MCP tools.

1. Read `ba-project.yaml`. Missing → say so and suggest `/ba-new <confluence-url>`; stop.
2. **Source version.** Call `mcp__<atlassian.mcp_server>__getConfluencePage` (`pageId: source.page_id`, `contentFormat: markdown`) and compare `version.number` with `source.version`. If `source.include_children`, also call `getConfluencePageDescendants` and compare with `source.children`. If MCP is unavailable, say so and continue with local data (mark "Confluence: not checked").
3. **Steps.** For each step in `steps`: status, source version it was built on, updated date, last approval from `approvals`. Mark a step `⚠ behind` if its `source_version` < `source.version`.
4. **Open items** (count with Grep, show IDs):
   - `docs/02-analysis/analysis-log.md`: CON with `Status: Open`, GAP not answered, items in "Open questions for the sponsor".
   - `docs/01-requirements/requirements.md`: rows with status `Proposed`.
   - `docs/07-changes/CHG-*.md`: reports not `Approved`.
   - Missing files that a step marked `draft` or later should have produced.
5. **Next action.** Name exactly one: the next `/ba-continue` step and its gate, `/ba-sync` if Confluence is newer, or the BA decision that blocks progress.

Reply in Russian with three small tables (Source · Steps · Open items) and one line "Next". No other output.
