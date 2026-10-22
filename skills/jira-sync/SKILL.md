---
name: jira-sync
description: BA kit step 9 — publish the reviewed backlog to Jira through the Atlassian MCP server named in ba-project.yaml — epics, stories, sponsor-question tasks, with issue types by ID, priority and MoSCoW labels from the project settings; plan first, BA OK, then idempotent create/update without duplicates or deletions. Writes docs/05-jira/jira-map.md. Use from /ba-continue (step jira) or when the BA asks to sync the backlog to Jira.
---

# Step 9 — publish the backlog to Jira

Load `ba-rules` first and follow it — especially §5 (MCP tools as `mcp__<atlassian.mcp_server>__<tool>` with `cloudId: <atlassian.cloud_id>`) and §6 (never delete issues, never touch anything outside `jira.project_key`). Read `ba-project.yaml`.

## Gate
- `steps.review.status` is `reviewed` or `approved` (backlog `Reviewed`). Spec, build and deploy are not required: without `build-status.md` every story goes to To Do.
- Settings: `jira.project_key`, `jira.issue_types.{epic,story,task}` are set (not `null`). Missing → tell the BA (they come from `/ba-new --jira KEY`) and stop.

## 0. Pre-checks (stop and explain in the chat language if any fails)
- MCP reachable and authenticated: `getAccessibleAtlassianResources` lists `atlassian.site` with `cloud_id`, scopes `read:jira-work` and `write:jira-work`. Not authenticated → the BA runs `/mcp` → `<atlassian.mcp_server>` → Authenticate.
- Project exists: `getVisibleJiraProjects` with `searchString: <project_key>`; style matches `jira.style`.
- Issue types: `getJiraProjectIssueTypesMetadata` still contains the IDs in `jira.issue_types`. **Always create by ID, never by name** — names may be localized. A missing ID → stop; never guess another type.

## 1. Plan (no writes)
Read `docs/03-backlog/backlog.md`, `stories/US-*.md`, `docs/02-analysis/analysis-log.md` §8 (open questions for the sponsor), `docs/04-spec/build-status.md` (if any), `docs/05-jira/jira-map.md` (if any — earlier sync).

| Item | Jira type | Summary | Description | Parent | Labels |
|---|---|---|---|---|---|
| Epic `EP-n` | `jira.issue_types.epic` | `EP-n <name>` | epic goal, list of its stories | — | `jira.labels.project` |
| Active story `US-xxx` (not `Superseded`, not deferred) | `jira.issue_types.story` | `US-xxx <title>` | story sentence · business rules · acceptance criteria (Gherkin in a code block) · "Traces to" · link `<repo.url>/blob/<repo.branch>/docs/03-backlog/stories/US-xxx.md` | its epic (`parent`) | `jira.labels.project`, MoSCoW label `jira.labels.moscow.<priority>`, cut-line band (`core-demo` / `next` / `drop-first`), `ab-variant` for A/B stories and the switch, `size-<S/M/L>` |
| Sponsor question `Q<n>` | `jira.issue_types.task` | `Q<n> <short question>` | question, origin (`DEC` / `CON` / `GAP`), options if any | — | `jira.labels.project`, `sponsor-question` |

- **Priority:** `jira.priority_map[<Must/Should/Could>]`. If `jira.priority_on_create` is `false`, it is set by an edit right after create (the field is not on the create screen).
- **Target status:** `done` for stories `Accepted` and deployed per `build-status.md`; `in_progress` for stories built but not accepted / not deployed; `todo` for everything else. Epics: `done` when all their stories are `done`, otherwise as the BA says.
- **Existing issues** (from `jira-map.md` or the search in §2): planned as **update** — only fields that differ. A story that became `Superseded` and exists in Jira → label `superseded` + comment with the replacing story; never delete.
- No Jira writes outside `jira.project_key`.

Show the plan as one table (action create/update · type · summary · parent · priority · labels · target status) plus counts, and **wait for the BA's OK** (decision point H8). On OK append to `approvals` `{step: jira, status: plan-ok, by: <people.ba>, date, note: "<n> create, <m> update"}`.

## 2. Write — idempotent
1. Before each create, search: `searchJiraIssuesUsingJql` with `project = <KEY> AND labels = "<jira.labels.project>" AND summary ~ "\"US-006\""` (or `EP-2`, `Q3`). Found → update it instead of creating a duplicate; found more than one → stop and show them to the BA.
2. Order: epics → stories (with `parent` = epic key) → tasks.
3. Priority by edit after create when `priority_on_create` is `false`.
4. **Statuses on the first run:** if `jira.statuses` has `null` values, read `getTransitionsForJiraIssue` on the first created issue and map the target statuses by status category (To Do / In Progress / Done — names may be localized). Unclear → ask the BA. Write the IDs to `jira.statuses` in `ba-project.yaml` (field owned by this step). Then transition every item whose target status is not the initial one.
5. Read back one created story (`getJiraIssue`) and check that the description kept its structure (tables and code blocks can be lost in conversion). Lost → simplify the formatting (lists instead of tables) and update.
6. A failed call → stop, show the error in the chat language, propose a fix; do not retry blindly and do not continue with other writes.

## 3. Sprint
The Atlassian MCP has no sprint tools. Tell the BA to create (and start, if wanted) the sprint in the Jira UI. After that, only on the BA's request, issues can be added to it by editing the sprint field of each issue; nothing else changes.

## 4. Record and report
1. `docs/05-jira/jira-map.md` — header (golden rule 8, `Generated by: jira-sync (BA kit)`, project key, site, link to the board, issue type IDs, status IDs), then tables Epics / Stories / Sponsor questions: `Backlog ID · Jira key · link · parent · priority · labels · status`; BA decisions for this sync; skipped items with the reason.
2. `ba-project.yaml`: `steps.jira = {status: draft, source_version: <source.version>, updated: <today>}`.
3. Append to `docs/run-log.md`: created / updated / unchanged per type, skipped, duration, errors.
4. Reply in the chat language: counts by type, link to the board, anything skipped, the sprint reminder, proposed commit `step 9: backlog published to Jira`. A second run must create 0 duplicates. The BA's "reviewed" moves `steps.jira` to `reviewed` (append to `approvals`).
