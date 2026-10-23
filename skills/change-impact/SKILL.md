---
name: change-impact
description: BA kit step sync — the source Confluence page (or a child page) has a newer version. Snapshot v<new> next to the old one, block diff, trace each changed block through source quotes to REQ → DEC → stories → tests → Jira, classify C0–C6, write docs/07-changes/CHG-xxx.md with a row-by-row rework plan, stop for the BA's OK; after the OK rework only the affected items (Superseded, never deleted) and update Jira through jira-sync. Use from /ba-sync only.
---

# Step sync — change impact

Load `ba-rules` first and follow it — especially golden rules 1 (snapshots are append-only), 6 (`Superseded by`, never silent overwrite) and §6 (no artifact changes before the BA's OK on the CHG plan). Read `ba-project.yaml`. MCP tools: `mcp__<atlassian.mcp_server>__…` with `cloudId: <atlassian.cloud_id>`, read-only towards Confluence.

Script: `scripts/blockdiff.mjs` in this skill's directory (Node ≥ 18, no dependencies). It is deterministic: block parsing, diff, quote lookup. Classification C1–C6 and the impact chain are judgement — the `impact-analyst` agent proposes, the BA confirms.

## Phase A — detect, snapshot, report (no artifact changes)

### A0. Gate
- `steps.ingest` is `draft` or later; `source.version` is set.
- An open change report exists (`docs/07-changes/CHG-*.md` with `Status: Draft`, or `Approved` with plan rows not `Done`) → do not start a new one: resume it (Draft → show it again and wait for the OK; Approved → continue Phase B from the first row not `Done`).
- `git status --porcelain` is empty. Otherwise list the paths and propose a commit first, then wait — the sync must be reviewable as its own diff.

### A1. Read the current versions (MCP)
- Main page: `getConfluencePage` (`pageId: source.page_id`, `contentFormat: markdown`) → `version.number`, `version.message`. If the response has no version block, use `fetch` with id `ari:cloud:confluence:<cloud_id>:page/<page_id>` (as `ingest-confluence` did; see the snapshot's `meta.json` notes).
- If `source.include_children`: `getConfluencePageDescendants` → id, title; the version of each child the same way.
- Attachments are not visible through MCP. If the BA came from a watch issue that lists attachment changes, ask the BA to put the files into `docs/00-source/inbox/`; they are classified `C6`.
- Compare with `source.version` and `source.children`. Nothing changed → say "no new version" (and, if a watch issue is open, that it can be closed) and stop. Write nothing.

### A2. Snapshot the new versions
For every changed or new page run `ingest-confluence` **§1–§2 only** (snapshot mode): new folder `docs/00-source/confluence/<pageId>/v<new>/` with `page.html`, `page.md`, `meta.json`. `<new>` is the version Confluence reports — usually `v<old+1>`; if the page was edited several times since the last sync, the snapshot is the current version and the CHG covers the cumulative change. Never touch an existing `v<N>` folder. A removed child page keeps its old snapshots. Working sources (`docs/00-source/NN-*.md`), README and `ba-project.yaml` stay unchanged until Phase B.

### A3. Block diff and quote hits (script)
Next free number `CHG-xxx` (3 digits) in `docs/07-changes/`. Run from the project root:

```
node <skill-dir>/scripts/blockdiff.mjs diff --root docs/00-source/confluence --page <id>:<old>:<new> [--page <childId>:<old|->:<new|->] --docs docs --out docs/07-changes/CHG-xxx/changes.json
node <skill-dir>/scripts/blockdiff.mjs quotes --root docs/00-source/confluence --page <id>:<old> [--page <childId>:<old>] --docs docs --out docs/07-changes/CHG-xxx/quotes-before.json
```

`-` = page did not exist (new child) or no longer exists (removed child). Every page in `source.children` is passed, unchanged ones as `<id>:<v>:<v>`.

- `changes.json`: per page, changes `D1…Dn` with `op` (`cosmetic` · `modified` · `added` · `removed` · `moved`), old / new block (path of headings, bold label, text), `numbers` (when digits changed), `hint` (`C0` for cosmetic; `C1?` when no number changed and the text is ≥ 80 % the same) and `hits` — artifact lines whose source quote lies in the old block, with `still_in_new`.
- `quotes-before.json`: quotes on artifact lines that cite a source (`[KEY · Section]`) and are **not** found in the old snapshot. Read each: a real trace break (the quote was edited by hand) or a false positive (UI text, a phrase quoted from another artifact). Real breaks → show them to the BA before the report: fix first, or continue with them listed as a risk in the CHG. The BA decides.

### A4. Impact analysis (agent `impact-analyst`)
Delegate to `impact-analyst` with: the CHG id, paths of `changes.json` and `quotes-before.json`, `ba-project.yaml`, the path of the `ba-rules` skill's `SKILL.md`, and the instruction to return the report in the agent's format. The agent only reads; it returns text.

Check the returned report before using it:
- every change `D-n` from `changes.json` has a class (`C0`–`C6`) and a row in the Impact table;
- every ID it names exists (Grep); every Jira key exists in `docs/05-jira/jira-map.md`;
- the plan touches only items listed in Impact; every item from `hits` is either in Impact or in "Not affected" with a reason.
A failed check → fix it yourself from the files, or ask the agent once more with the list of problems. Never pass an unchecked report to the BA.

### A5. Write `docs/07-changes/CHG-xxx.md`
Header (golden rule 8): `Generated by: /ba-sync (change-impact, impact-analyst)`, date, page `<id>` `v<old> → v<new>` (+ children), Confluence version message, inputs, `Status: Draft`, `Approved by: —`. Then the report sections (the agent's format, kit design §5.4):

1. **Summary** — changes by class; steps affected; architect-rule re-check result; Jira issues touched.
2. **Changes** — `# · D-n · class · page · section (block path) · was (quote) · now (quote) · why this class`.
3. **Impact** — `# · change → source item (REQ/NFR/CST/OOS) → DEC/CON/GAP/ASM → stories (US) → AC / tests (test-plan) → config / spec → Jira key → build status`.
4. **Plan** — `# · action · item(s) · step · how (supersede / revise in place / new) · HITL? · Jira action (key · update fields / create / label superseded) · BA OK`. One row per action, in step order. `BA OK` empty.
5. **Not affected** — steps and items checked and left as they are, with the reason (the boundary the BA can see).
6. **Trace issues before sync** — from `quotes-before.json` (or "none").
7. **Log** — empty until Phase B.

### A6. Show the report and stop (decision point H9)
In the chat language: the Summary, Changes and Plan tables (Impact on request or when short), the path of the CHG file, and what the BA answers: "OK" (every row) / "OK 1–4, 6; 5 — <change>" / "нет". C4 rows say that a new conflict will be decided by the BA before anything downstream changes (H10). Propose a commit `sync: CHG-xxx snapshot v<old>→v<new>` (snapshot + CHG only). **Stop.**

C0 only (every change `cosmetic`): the plan is one row "accept the snapshot, `source.version` → v<new>; no artifact changes". Still ask for the OK.

## Phase B — rework after the OK (only what the BA approved)

### B0. Record the OK
In the CHG: `BA OK` per row (`OK` · `No — <BA's words>` · `Changed — <what>`), `Approved by: <people.ba>, <date>`, `Status: Approved — rework in progress`. Append to `approvals` `{step: sync, status: plan-ok, by: <people.ba>, date, note: "CHG-xxx v<old>→v<new>: rows <list>"}`. Rows the BA rejected are not done; say how this leaves the trace (e.g., a quote that no longer matches the source) and list it in Log.

### B1. Statuses and sources
- Every step with at least one approved row → `steps.<key>.status: stale`. Other steps keep their status.
- Regenerate the working sources of the changed pages: `ingest-confluence` §3 (README: file table, source keys — a new child page gets its own key; a removed child page's key stays with `Removed in v<new> (CHG-xxx)`).

### B2. Rework, step by step, in step order — only approved rows
Each step's skill runs in **scoped mode**: it gets the list of IDs and CHG rows (`scope: [REQ-004, US-006]`, `CHG-xxx #2–#5`) and changes nothing else. Follow that skill's own rules (format, header, decision points).

| Step | What changes (by class) |
|---|---|
| requirements | C1: quote updated in place + `Revised CHG-xxx (C1)` in the status column. C2: new row with the next free ID and the new value; the old row → `Superseded by REQ-xxx (CHG-xxx)`. C3: new rows `Proposed`, quote from the new snapshot. C5: row → `Superseded by CHG-xxx — removed from the source`. C4: no change here until the BA decides the new CON. |
| conflicts | C4: new `CON-xxx` (position A = the new source block, position B = the DEC / CST / OOS it reverses), options + `Claude's recommendation` → **stop, the BA decides (H10)** → `DEC-xxx`; the old DEC → `Superseded by DEC-xxx`. C2 / C3 / C4: re-check the architect rule (`ba-rules` §7) and new GAPs (missing facts). An ASM that the new source text settles → `Superseded by REQ-xxx (CHG-xxx)`; the matching sponsor question is answered. |
| stories | A story whose intent stays: revised in place — the changed business rules and AC, `Traces to` updated, a line `Revised: CHG-xxx — <what>` under the header. A story that no longer holds (C5, or a C4 outcome): `Status: Superseded by US-xxx` or `Superseded by CHG-xxx`, never deleted. New stories (C3 / C4) → next free US ID, `Draft`. Then `review-backlog` in scoped mode on the changed and new stories only. |
| spec | Only the touched parts: `config.md` constants (value + source), `test-plan.md` rows of changed scenarios, other spec files where a changed item is cited. |
| build | `build` with the story: tests of changed scenarios first (they must fail against the old behaviour), then the code / config change, full suite green; the BA accepts each reworked story (H6). |
| deploy | Only through `deploy` with the BA's explicit OK in this conversation (H7). |
| jira | `jira-sync` in scoped mode with the Jira column of the approved rows (see B3). |

After each step: its status → `draft`, `source_version: <new>`, `updated`; the header of every changed artifact shows the new source version (`Confluence <id> v<new>`). The BA's "reviewed" moves the step on as usual (`approvals`).

### B3. Jira
The Jira actions in the approved CHG plan **are** the jira-sync plan for this sync: `jira-sync` runs them (update fields, create, label `superseded` + comment with the replacing item) without a second plan, and nothing beyond them. Any other Jira change it finds necessary → a new plan → the BA's OK. Never delete an issue. Update `docs/05-jira/jira-map.md` (superseded rows stay, with the new key next to them).

### B4. Trace check (agent `trace-auditor`)
When every approved row is done (or the BA stops the rework), run:

```
node <skill-dir>/scripts/blockdiff.mjs quotes --root docs/00-source/confluence --page <id>:<new> [--page <childId>:<v>] --docs docs --out docs/07-changes/CHG-xxx/quotes-after.json
```

and delegate to `trace-auditor` with the CHG id, `changes.json`, `quotes-after.json`, `ba-project.yaml` and the path of the `ba-rules` skill's `SKILL.md`. It only reads and returns its findings. Show them to the BA; findings that are rework mistakes are fixed now (only within the approved rows); the rest goes to CHG Log.

### B5. Close
- `ba-project.yaml`: `source.version`, `source.snapshot_at`, `source.children` → the new values. Steps checked in "Not affected" and not reworked → `source_version: <new>` (status unchanged).
- CHG: each plan row `Done — <commit or file>` / `Not done — <reason>`; Log (what changed, trace check result, Jira keys); `Status: Reviewed` only on the BA's word, otherwise `Draft — rework done`.
- `docs/run-log.md`: one row (CHG id, versions, rows done, steps touched, duration).
- Reply in the chat language: what changed, steps now `draft` (what the BA reviews first), trace check result, Jira changes, a watch issue to close. Propose commit `sync: CHG-xxx v<old>→v<new>`; push only on request.

## Rules
- Before the OK only the snapshot folder and `docs/07-changes/CHG-xxx*` are written.
- Nothing outside the approved rows changes; an item that looks affected but is not in the plan → tell the BA and add a row only after the BA's OK.
- Never delete: removed source content → `Superseded by CHG-xxx`; old values stay readable.
- The class is the heaviest one a change qualifies for (C4 > C5 > C2 > C3 > C6 > C1 > C0). A `moved` block with unchanged text is C0 unless its new section changes its meaning (then C2 / C4).
- A change the script marks `C1?` is C1 only if no fact changes: no number, date, time, name, role, scope word ("no", "only", "must"). Otherwise C2 or C4.
