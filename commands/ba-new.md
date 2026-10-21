---
description: Start a BA kit project from a Confluence page — check the Atlassian MCP connection, create ba-project.yaml and the docs skeleton, then ingest the page
argument-hint: <confluence-page-url> [--jira KEY]
---

Load the `ba-rules` skill first and follow it. Arguments: `$ARGUMENTS`.

You set up a new BA kit project **in the current working directory**. Talk to the BA in Russian (default chat language). Write nothing until step 5.

## 1. Parse the arguments
- Confluence URL forms: `https://<site>/wiki/spaces/<SPACE>/pages/<pageId>/<slug>` or a tiny link `https://<site>/wiki/x/<code>` (pass the code as `pageId`). `--jira KEY` is optional.
- No URL → ask for it and stop.
- If `ba-project.yaml` already exists → show its `source.*` and `jira.project_key`, say that the project is already set up, suggest `/ba-status`, and stop. Never overwrite it.

## 2. Find the Atlassian MCP server
- Read `.mcp.json` in the project (and the user's MCP config if needed). Candidates: servers whose URL is on `mcp.atlassian.com`. One → use its name. Several → ask the BA. None → explain how to add one (`.mcp.json` entry `{"type": "http", "url": "https://mcp.atlassian.com/v1/mcp"}`) and stop.
- Call `mcp__<server>__getAccessibleAtlassianResources`. If the tools are missing or unauthenticated → tell the BA to run `/mcp` → `<server>` → Authenticate, and stop.
- Pick the resource whose `url` host equals the site from the URL → `cloud_id`. Check the scopes: needs `read:page:confluence`; for Jira `read:jira-work` and `write:jira-work`. Report missing scopes; Confluence read is mandatory.

## 3. Read the source page (read-only)
- `getConfluencePage` with `pageId`, `contentFormat: markdown` → title, `spaceId`, version number and date. Map `spaceId` to the space key with `getConfluenceSpaces` (`ids`).
- `getConfluencePageDescendants` → count and titles of child pages.
- Attachments cannot be listed through the MCP tools: note "attachments — check on the page; put files into `docs/00-source/inbox/`".

## 4. Read the Jira project (if `--jira`, otherwise ask whether Jira is used now or later)
- `getVisibleJiraProjects` with `searchString: KEY` → name, `style` (`next-gen` = team-managed, `classic` = company-managed).
- `getJiraProjectIssueTypesMetadata` → IDs of Epic, Story, Task. Names may be localized: match by `hierarchyLevel` (1 = epic, 0 = standard) and by known names in several languages (Epic/Эпик, Story/История, Task/Задача). Unclear → ask the BA.
- `getJiraIssueTypeMetaWithFields` for the story type → `priority_on_create` = whether `priority` is among the fields.
- Statuses stay `null`: `jira-sync` reads them from the first issue's transitions.

## 5. Confirm with the BA (decision point H0)
Show one table: site · cloud id · MCP server · space · page id · title · version · child pages · Jira key / style / issue type IDs / priority on create · deploy profile `static` (default; alternatives `local`, `cloudflare`, `none`) · repo URL and visibility (`git remote get-url origin`; `static` on GitHub Pages of a free account needs a public repo) · watch Action (off for now). Ask the BA to confirm or correct: project name, BA name, deploy profile, include child pages. **Wait for OK.**

## 6. Create the skeleton
Templates are in the `ba-rules` skill directory under `templates/project/`. Copy them into the project root, keeping paths:
- `ba-project.yaml` — replace every `{{…}}` placeholder with the confirmed values (Jira placeholders → `null` if no Jira yet; `{{PRIORITY_ON_CREATE}}` → `true`/`false`/`null`). Set `stack.deploy.profile` to the BA's choice. Append to `approvals`: `{step: setup, status: approved, by: <BA>, date: <today>, note: "ba-new"}`.
- `CLAUDE.md` — fill the placeholders. If a `CLAUDE.md` already exists, do not overwrite: show the BA the kit section and ask where to add it.
- `.claude/settings.json` — fill `{{MCP_SERVER}}`. If it exists, merge the `deny`/`ask` lists and show the diff.
- `.gitignore` — create or append missing lines.
- `.gitattributes` — create or append missing lines (snapshots under `docs/00-source/confluence/` are stored without line-ending conversion).
- `docs/` — all READMEs, `docs/run-log.md`, `docs/00-source/inbox/.gitkeep`.
Never copy anything else, never write outside the project directory.

## 7. Ingest
Run the `ingest-confluence` skill (first snapshot). It updates `source.*` and `steps.ingest`.

## 8. Finish
- Append to `docs/run-log.md`: `setup + ingest`.
- Reply in Russian: what was created (file tree), source version, Jira IDs found, what is still `null` and why, next step `/ba-continue` (requirements). Propose commit `step 0: kit setup + ingest v<N>`; commit only after the BA agrees.
