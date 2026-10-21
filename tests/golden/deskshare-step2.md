# Golden — DeskShare, step 2 (requirements)

| | |
|---|---|
| **Purpose** | Reference list of **topics** the kit's `requirements` step must cover in test A (design §8, §12 K-5) |
| **Reference** | `C:\Projects\deskshare\deskshare`, commit `e8f3d88` "step 2: extract requirements v1" — `docs/01-requirements/requirements.md` as it was after step 2 (before step 3 added REQ-015+). Read-only |
| **Compared with** | `docs/01-requirements/requirements.md` of the test project after `requirements` (draft, before BA review) |
| **Pass criterion** | **Every `Must` topic is covered.** `Should` topics are reported, not blocking |

## How to compare

1. A topic is **covered** when at least one row (REQ / NFR) or §8 observation of the kit's output states the same rule or finding — wording and IDs may differ; one golden topic may be split across several kit rows, or several topics merged in one row only if each rule stays testable.
2. Topic priority here = golden weight, not MoSCoW. For REQ/NFR it is DeskShare's priority (`Must` → Must; `TBD` → Should). For observations it is set below.
3. Write the result in the test report as a table: golden ID · covered by (kit IDs / observation #) · `covered` / `partial` / `missing` · note. Count Must covered / Must total; extra kit rows not in the golden list are listed separately (they are not errors by themselves — check them against the sources).
4. Source `BR` (workshop brief) exists in Confluence only as the child page "Workshop brief (source copy)" of `65670` (design §12 K-6). If the kit run did not ingest the child page, topics with source `BR` are marked `n/a (no BR)` and do not count against the criterion.

## Functional requirements

| Golden | Topic | Source in DeskShare | Weight |
|---|---|---|---|
| REQ-001 | Employee selects a **date** for a booking | CTX · Done; W2 · Booking a desk | Must |
| REQ-002 | Employee selects a **floor** (Floor 1 / Floor 2) | W2 · Booking a desk | Must |
| REQ-003 | Employee **types their name** as free text (no login) | W2 · Out of scope | Must |
| REQ-004 | Booking confirmed **immediately, no approval step** | W2 · Booking a desk | Must |
| REQ-005 | Show **booked and remaining desks per floor** for a selected date | CTX · Done; W2 · Privacy | Must |
| REQ-006 | **Refuse** a booking when the floor is at capacity (hard stop, not a warning) | W2 · Capacity limits | Must |
| REQ-007 | On refusal, tell the employee to **pick another day or floor** | W2 · Capacity limits | Must |
| REQ-008 | Employee **cancels own booking** without Office Manager / IT | CTX · Done; W2 · Cancelling | Must |
| REQ-009 | **State effect of cancel:** the place counts as available capacity again | CTX · Current state; CTX · Done | Must |
| REQ-010 | Employee **confirms (checks in)** a booking | W3 · No-show | Must |
| REQ-011 | **Auto-release** of an unconfirmed booking at a cutoff time; the place returns to capacity | W3 · No-show | Must |
| REQ-012 | Show **which desk teammates booked** (employee ask, open conflict C1) | W3 · Show me where my team sat | Should |
| REQ-013 | **List of who is in the office** on a day, for emergency headcount (open conflict C3) | W3 · Identity trust | Should |
| REQ-014 | Office Manager's **one screen: is tomorrow a problem** | BR · Stakeholders | Should |

## Non-functional requirements

| Golden | Topic | Source in DeskShare | Weight |
|---|---|---|---|
| NFR-001 | **Browser, responsive on mobile**; no native app | W2 · Out of scope; W1 · Decisions | Must |
| NFR-002 | **Privacy:** only counts per floor, no individual attendance history | W2 · Privacy | Must |
| NFR-003 | **Privacy:** no list or export of who came in on which days | W2 · Privacy; W1 · Discussion | Must |
| NFR-004 | **Data:** booking may store the name for the booking itself | W2 · Privacy | Must |
| NFR-005 | **Maintainability:** no backend server / database for IT to operate | W1 · Discussion; CTX · Decision makers | Must |
| NFR-006 | — removed in DeskShare BA review (duplicate of CST-002); not a topic | — | — |
| NFR-007 | **Responsiveness:** booking result shown immediately (no measurable target) | W2 · Booking a desk | Should |
| NFR-008 | **Demo-readiness:** clickable, good enough for the sponsor's leadership demo | HO · Sales notes; CTX · Done | Must |
| NFR-009 | **Identity trust:** names trustworthy enough for emergency headcount (C3, known limitation) | W3 · Identity trust | Should |

## Observations (§8)

| Golden | Topic | Weight |
|---|---|---|
| O-01 | **Shared data vs. no shared backend:** capacity, hard stop and auto-release need all users to see the same data, but DEC "no shared backend/database"; hosting acceptance by IT has no outcome | Must |
| O-02 | **Capacity vs. headcount:** ~120 people, 3 anchor days vs. 55 desks; anchor days same for all? | Should |
| O-03 | **Numbers without basis:** "1 in 5 no-shows" and capacities come from a spreadsheet we do not have, which itself is unreliable | Must |
| O-04 | **Dangling references:** fire-drill use case "from Workshop 1" not in W1; Sam's "position from Workshop 1" on no-login is in W2; Priya's "earlier ballpark"; full sales handoff doc | Must |
| O-05 | **Check-in mechanic undefined:** cutoff time, how/where, before the day?, what happens to the freed place | Must |
| O-06 | **Decision without a named decider:** W3 "agreed" new scope vs. Priya as single sign-off | Should |
| O-07 | **"Cancel own booking" without identity:** free-text name cannot prove ownership | Must |
| O-08 | **Fire-drill list vs. privacy:** same-day list vs. "who came in which days" | Should |
| O-09 | **Teammates' desks vs. floor-level booking** (desk-level parked; no team data) | Should |
| O-10 | **Ambiguous status of C3:** "known limitation, not a build item" and also open for the sponsor's call | Must |
| O-11 | **"See a desk immediately" / "double-booking desks"** vs. floor-level booking | Should |
| O-12 | **Missing booking rules:** how far ahead, past dates, weekends, one booking per person per day, same names | Must |
| O-13 | **"Tomorrow's a problem" undefined**; only a slide quote | Should |
| O-14 | **Missing NFRs:** retention, performance target, accessibility, browsers, availability, concurrent users | Must |
| O-15 | **Data migration:** import the Google Sheet or start empty — not stated | Must |
| O-16 | **Scope growth vs. fixed scope:** fixed-scope engagement, but W3 added new scope | Must |

## Totals

| | Must | Should |
|---|---|---|
| REQ | 11 | 3 |
| NFR | 6 | 2 |
| Observations | 10 | 6 |
| **All** | **27** | **11** |
