---
description: "[TODO — iteration 2] Run the next BA kit step up to the next BA decision point"
argument-hint: [step]
---

Load the `ba-rules` skill first.

**Not implemented yet (kit iteration 1).** Tell the BA in Russian that `/ba-continue` is a stub, and stop. Do not run any step.

TODO (kit design §1.2, §4 of `ba-rules`):
- Read `ba-project.yaml`; pick the first step whose status is not `reviewed`/`approved`/`skipped` and whose previous step is ≥ `reviewed` (or the step given as argument, after checking its gate).
- Run its skill; continue through steps without a BA decision point; stop at the next decision point (H1…H8).
- For `build`: stop after each story.
- Until then the BA can call implemented skills directly: `ingest-confluence`, `requirements`.
