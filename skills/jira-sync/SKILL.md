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
- Issue types: `getJiraProjectIssueTypesMetadata` still contains the IDs in `jira.issue_types`. **Always create by ID, never by name** — names may be localized (pass the ID as `additional_fields.issuetype.id`, not as the type name). A missing ID → stop; never guess another type.
- Sprint field: `getJiraIssueTypeMetaWithFields` for the story type → the field with schema `com.pyxis.greenhopper.jira:gh-sprint` (often `customfield_10020`) → `jira.sprint.field`. Absent → the project has no sprints (kanban); the plan then has no Sprint column.

## 0a. Sprint — before any create (only when `jira.sprint.field` is set)
The Atlassian MCP has no sprint tools: the BA creates the sprint in the Jira UI. Ask the BA **to create the sprint and start it** (Backlog → Create sprint → Start sprint) and to say its name. Explain why in one line: until the sprint is started the board stays empty and a board link shows nothing.
- If Jira does not let the BA start an empty sprint: create the first story only (§2), ask the BA to drag it into the sprint and start it, then go on.
- Sprint id, state and board: read the sprint field of an issue already in that sprint (`getJiraIssue`, field `jira.sprint.field` → `id`, `name`, `state`, `boardId`) → `jira.sprint = {field, id, name, board_id}` in `ba-project.yaml`. Never guess a sprint id.
- The BA does not want a sprint now → the plan says "no sprint"; the board link is not given (see §4).
- **Team-managed** (`jira.style: team-managed`): epics cannot be put into a sprint. Say so in the plan (Sprint column of epics: "— epics are not in sprints (team-managed)") so that nobody expects them on the board.

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

Show the plan as one table (`#` · action create/update · type · summary · parent · priority · labels · sprint · target status) plus counts, and **wait for the BA's OK** (decision point H8). Warn in the same message what the BA will see afterwards: issues in status Done are not shown in the Backlog view — they are on the Board (column Done, while the sprint is active) and in the List view (`https://<site>/jira/software/projects/<KEY>/list`); epics of a team-managed project are not on the sprint board.

On OK:
1. Write the approved plan into `docs/05-jira/jira-map.md` § "Plan (approved <date>)" — the same table. It is the list of writes this run may make.
2. Append to `approvals` `{step: jira, status: plan-ok, by: <people.ba>, date, note: "<n> create, <m> update; sprint <name | none>"}`.

**The approved plan is the permission to write exactly these issues.** The project template allows `createJiraIssue`, `editJiraIssue`, `transitionJiraIssue` and `addCommentToJiraIssue` without a prompt per call (kit design §7.3, K-15), so the plan is the only check: every write must match a plan row (`#`). A write that is not in the plan (an extra issue, another field, another project) → stop, show it as an addition to the plan, wait for the BA's OK. Deleting issues and writing to Confluence stay forbidden (`ba-rules` §6; Confluence writes are denied in the project settings).

## 2. Write — idempotent
1. Before each create, search: `searchJiraIssuesUsingJql` with `project = <KEY> AND labels = "<jira.labels.project>" AND summary ~ "\"US-006\""` (or `EP-2`, `Q3`). Found → update it instead of creating a duplicate; found more than one → stop and show them to the BA.
2. Order: epics → stories (with `parent` = epic key) → tasks.
3. Priority by edit after create when `priority_on_create` is `false`. Sprint (if planned): set `jira.sprint.field` = `jira.sprint.id` on stories and tasks — never on epics of a team-managed project.
4. **Statuses on the first run:** if `jira.statuses` has `null` values, read `getTransitionsForJiraIssue` on the first created issue and map the target statuses by status category (To Do / In Progress / Done — names may be localized). Unclear → ask the BA. Write the IDs to `jira.statuses` in `ba-project.yaml` (field owned by this step). Then transition every item whose target status is not the initial one.
5. Read back one created story (`getJiraIssue`) and check that the description kept its structure (tables and code blocks can be lost in conversion). Lost → simplify the formatting (lists instead of tables) and update.
6. A failed call → stop, show the error in the chat language, propose a fix; do not retry blindly and do not continue with other writes.

## 3. Sprint state after the writes
Read the sprint field back on one story. `state: active` → the board link works. `state: future` (the BA has not started it yet) → say so and ask the BA to start it; do not give a board link until it is active. `closed` → tell the BA; the issues are in a closed sprint and do not appear on the board.

## 4. Record and report
1. `docs/05-jira/jira-map.md` — header (golden rule 8, `Generated by: jira-sync (BA kit)`, project key, site, links (see below), issue type IDs, status IDs, sprint name / id / state), then the approved plan, then tables Epics / Stories / Sponsor questions: `Backlog ID · Jira key · link · parent · priority · labels · sprint · status`; BA decisions for this sync; skipped items with the reason.
2. `ba-project.yaml`: `steps.jira = {status: draft, source_version: <source.version>, updated: <today>}`; `jira.sprint` (§0a).
3. Append to `docs/run-log.md`: created / updated / unchanged per type, skipped, duration, errors.
4. Reply in the chat language: counts by type, anything skipped, proposed commit `step 9: backlog published to Jira`, and **where to look**:
   - Board — `https://<site>/jira/software/projects/<KEY>/boards/<jira.sprint.board_id>` — **only when the sprint is active**; otherwise say that the board is empty until the BA starts the sprint, and give the backlog link (`…/boards/<board_id>/backlog`).
   - Done issues are not in the Backlog view: Board (column Done) or List (`https://<site>/jira/software/projects/<KEY>/list`).
   - Epics (team-managed): not on the sprint board — List view or the Timeline.
   A second run must create 0 duplicates. The BA's "reviewed" moves `steps.jira` to `reviewed` (append to `approvals`).
