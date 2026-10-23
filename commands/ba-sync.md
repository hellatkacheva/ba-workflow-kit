---
description: The source Confluence page changed — snapshot the new version, block diff, change report CHG-xxx with a rework plan; after the BA's OK rework only what is affected and update Jira. "setup-watch" installs the weekday GitHub Action
argument-hint: [setup-watch]
---

Load the `ba-rules` skill first and follow it. Reply in the chat language. Arguments: `$ARGUMENTS`.

No `ba-project.yaml` in the project root → tell the BA to run `/ba-new <confluence-url>` and stop.

## Without an argument — sync
Run the `change-impact` skill. It:
1. resumes an open `CHG-xxx` if there is one; otherwise reads the current versions of the page and its children through MCP and stops with "no new version" when nothing changed;
2. snapshots each new version next to the old ones (`docs/00-source/confluence/<pageId>/v<new>/`, old snapshots untouched), runs the block diff and the quote trace, gets the impact report from the `impact-analyst` agent and writes `docs/07-changes/CHG-xxx.md`;
3. **stops** for the BA's OK on the plan, row by row (decision point H9);
4. after the OK reworks only the approved rows (`Superseded by …`, never deleted; a new conflict → the BA decides, H10), updates Jira through `jira-sync` in scoped mode, runs the `trace-auditor` agent, and closes the CHG.

Before the OK nothing outside the snapshot folder and `docs/07-changes/` is written.

## `setup-watch` — weekday check without AI (kit design §6)
1. Copy from the `ba-rules` skill directory, `templates/project/`, into the project root — only files that do not exist yet (an existing file → show the diff and ask): `.github/workflows/confluence-watch.yml`, `scripts/confluence-watch.mjs`.
2. Do not set `watch.enabled` and do not touch secrets. Tell the BA, in the chat language, the steps that are theirs:
   - create an Atlassian API token **with read scopes only** — `read:page:confluence`, `read:hierarchical-content:confluence` (child pages), `read:attachment:confluence` (if `source.include_attachments`); a scoped token goes through `api.atlassian.com` with `atlassian.cloud_id` (the default); a classic token needs the repository variable `CONFLUENCE_API=site`;
   - `! gh secret set CONFLUENCE_EMAIL` and `! gh secret set CONFLUENCE_API_TOKEN` (the BA types the values; Claude never sees them);
   - set `watch.enabled: true` in `ba-project.yaml` (or say "включи watch" — then Claude edits that one field and appends `{step: setup, status: watch-enabled, by, date}` to `approvals`);
   - commit and push (on the BA's request), then run it once: `! gh workflow run confluence-watch` and check the job summary.
3. Explain what it does: weekdays 05:00 UTC; compares page / child / attachment versions with `ba-project.yaml`; opens one issue labelled `watch.issue_label` ("run /ba-sync") or comments on the open one (once per new state); auth / not-found errors → one issue labelled `ba-watch-error`. It never writes to the repository or to Confluence. After a sync is committed and pushed, the BA closes the issue.

## Log
Append one row to `docs/run-log.md`: date, `/ba-sync` (or `setup-watch`), versions, CHG id, where it stopped and why — only when the run wrote something (snapshot, CHG, watch files). No new version → write nothing, not even `run-log.md`; the reply to the BA is the only record (as `change-impact` A1).
