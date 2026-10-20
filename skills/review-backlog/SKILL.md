---
name: review-backlog
description: "STUB — not implemented yet (BA kit iteration 2). BA kit step 5: independent backlog review by the backlog-reviewer agent, BA accepts fixes. Do not use until implemented."
---

# Step 5 — review-backlog (stub)

**Not implemented yet.** If invoked, tell the BA in the chat language that this step is a stub in kit iteration 1, and stop. Do not write any file.

TODO (kit iteration 2):
- Port from DeskShare `.claude/commands/review-backlog.md`, generalised per kit design §2.2 (no project names, IDs, sites or stack values in the text — read them from `ba-project.yaml`).
- Follow `ba-rules` (gate, statuses, decision points, never-do list).
- Delegate to agent `backlog-reviewer`; BA accepts/rejects findings; set `reviewed` only without blockers.
