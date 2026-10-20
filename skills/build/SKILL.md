---
name: build
description: "STUB — not implemented yet (BA kit iteration 2). BA kit step 7: build the PoC one story at a time, tests first. Do not use until implemented."
---

# Step 7 — build (stub)

**Not implemented yet.** If invoked, tell the BA in the chat language that this step is a stub in kit iteration 1, and stop. Do not write any file.

TODO (kit iteration 2):
- Port from DeskShare `.claude/commands/build.md`, generalised per kit design §2.2 (no project names, IDs, sites or stack values in the text — read them from `ba-project.yaml`).
- Follow `ba-rules` (gate, statuses, decision points, never-do list).
- Scaffold per deploy profile: `static` (HTML/JS + localStorage), `local` (Node + SQLite), `cloudflare` (Worker + D1).
- One story per run; stop after each story.
