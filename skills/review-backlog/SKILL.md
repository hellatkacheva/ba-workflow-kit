---
name: review-backlog
description: BA kit step 5 — independent review of the backlog by the kit's backlog-reviewer agent (a separate critic that did not write it), then the BA accepts or rejects each finding and only accepted fixes are applied. Writes docs/03-backlog/review.md and updates stories. Use from /ba-continue (step review) or when the BA asks for a backlog review.
---

# Step 5 — review the backlog

Load `ba-rules` first and follow it — especially golden rule 4 (the BA decides trade-offs) and the decision rules (§3). Read `ba-project.yaml`.

## Gate
- `steps.stories.status` is `reviewed` or `approved`. Otherwise stop and tell the BA.
- If `review.md` exists with findings that have no BA outcome yet → **resume step 3 below** from the first finding without an outcome; do not run the reviewer again.
- If `review.md` exists and every finding has an outcome → this step only needs the BA's "reviewed"; say so and stop.

## 1. Independent review
Delegate to the kit's **`backlog-reviewer`** agent (plugin agent; it has Read, Grep, Glob and Write for `docs/03-backlog/review.md` only). Pass it **only** the instruction to review the current backlog of this project — no summary, no opinion, no hints about known weak spots; it forms its own view from the files.

The agent writes `docs/03-backlog/review.md`. If it fails or writes anything else, stop and report.

## 2. Check the report
Read `review.md`. Verify that every finding cites a file and evidence that exists (spot-check quotes with Grep). Drop nothing; if a finding is wrong, say so to the BA with the reason — the BA decides.

## 3. BA decisions (decision point H4)
Present the findings in the chat language, grouped by severity (Blocker / Major / Minor), max 3 lines each.
- **Fix findings** (the fix follows from existing requirements/decisions): ask which to apply — all Blockers by default.
- **Trade-off findings** (marked `BA decision` by the reviewer, or needing a scope/stakeholder call): one at a time, with options and `Claude's recommendation`, outcome per decision rules. Record each as `DEC-xxx` in `analysis-log.md` (section "Decisions from the backlog review") with `Decided by` and date; new rules → `Proposed` rows in `requirements.md` with source `[DEC-xxx]`.

## 4. Apply
- Apply only accepted fixes to `backlog.md` and `stories/US-xxx.md`. Add to each changed story header: `Updated <date> by review-backlog (finding #n[, DEC-xxx])`. Merged or removed stories are marked `Superseded by …`, never deleted; IDs never reused.
- Keep the coverage matrix, cut line and A/B groups consistent with the changes.
- In `review.md` add the section **"BA outcome (<date>)"**: `#` · severity · outcome (`Fixed` · `Accepted by BA — DEC-xxx` · `Rejected by BA — <reason>` · `Deferred — sponsor decision`) · record · applied in.
- Deploy profile changes are not fixes: a finding that needs storage or services beyond `stack.deploy.profile` goes through the architect rule (`ba-rules` §7) as a `CON`.

## Quality bar
- Every finding has a BA outcome; no Blocker is left without `Fixed` or an explicit BA acceptance.
- Every applied fix is visible in the story header; every DEC from this step is in `analysis-log.md`.

## Finish
1. `ba-project.yaml`: `steps.review = {status: draft, source_version: <source.version>, updated: <today>}`. If no Blocker remains open, propose "reviewed" to the BA — only the BA's words move it.
2. Append to `docs/run-log.md`: findings by severity, fixed / accepted / rejected / deferred, new DECs.
3. Reply in the chat language: counts, what was changed, rejected findings with reasons, the reviewer's verdict, proposed commit `step 5: backlog reviewed`. Next step: `spec` (iteration 2b).
