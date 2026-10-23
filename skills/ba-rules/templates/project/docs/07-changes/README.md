# 07-changes

Source change reports — one per sync of a new Confluence version.

| Path | What |
|---|---|
| `CHG-xxx.md` | Change report: summary, changes with classes C0–C6, impact chain REQ → DEC → US → tests → Jira, rework plan with the BA's OK per row, not affected, log |
| `CHG-xxx/changes.json` | Block diff old ↔ new snapshot with quote hits (script `blockdiff.mjs`, deterministic) |
| `CHG-xxx/quotes-before.json`, `quotes-after.json` | Source quotes not found in the old / new snapshot (trace check before and after the rework) |

Written by: `/ba-sync` (skill `change-impact`, agents `impact-analyst`, `trace-auditor`). Nothing here is edited by hand except the BA's answers in the plan.
