---
description: "[TODO — iteration 3] Source page changed — snapshot, diff, change report CHG-xxx, rework only what is affected after the BA's OK"
argument-hint: [--version N]
---

Load the `ba-rules` skill first.

**Not implemented yet (kit iteration 1).** Tell the BA in Russian that `/ba-sync` is a stub, and stop. Do not fetch, snapshot or change anything.

TODO (kit design §5):
- Fetch the current page version; if newer than `source.version`, snapshot it with `ingest-confluence` (snapshot only, no working-source regeneration yet).
- Block diff old ↔ new snapshot → `docs/07-changes/CHG-xxx/changes.json`.
- `trace-auditor` → `trace-index.json`; `impact-analyst` → draft `CHG-xxx.md` (classes C0–C6, impact chain, plan).
- Show the report; wait for the BA's OK per plan row; mark affected steps `stale`; rerun skills in scoped mode; `source.version = new`; commit `sync: CHG-xxx v<old>→v<new>`.
