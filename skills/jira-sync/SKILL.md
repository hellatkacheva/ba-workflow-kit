---
name: jira-sync
description: "STUB — not implemented yet (BA kit iteration 2). BA kit step 9: publish the reviewed backlog to Jira via the Atlassian MCP server. Do not use until implemented."
---

# Step 9 — jira-sync (stub)

**Not implemented yet.** If invoked, tell the BA in the chat language that this step is a stub in kit iteration 1, and stop. Do not write any file.

TODO (kit iteration 2):
- Port from DeskShare `.claude/commands/jira-sync.md`, generalised per kit design §2.2 (no project names, IDs, sites or stack values in the text — read them from `ba-project.yaml`).
- Follow `ba-rules` (gate, statuses, decision points, never-do list).
- Issue types by ID from `jira.issue_types`; statuses read from the first issue's transitions into `jira.statuses`.
- Plan → OK → idempotent create/update; never delete.
