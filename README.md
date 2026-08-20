# HOIST

**Every safety tool gates the irreversible action. HOIST reorders the plan around it.**

A confirmation dialog is a lookup nobody performed, handed to the person least
able to perform it, at the one instant they cannot afford it. HOIST does not
ask "are you sure?". It finds the questions that were *cheaper* than the
decisions they came after, and lifts them above.

**[Open the live demo →](https://phazon2.github.io/hoist/)** ·
[The receipt](ci/latest.json) ·
[What it does not do](docs/LIMITS.md)

---

## The rule, and it is one line

> If the lookup that could change a decision is cheaper than the decision is to
> reverse, the lookup is mandatory and is not a delay.

That is not a heuristic. It is a comparison between two numbers, both of which
the operator declares. HOIST never estimates either one — and where a number is
missing, it **refuses to produce a schedule at all**.

---

## The corpus is four real failures

These are not illustrative examples. They are four consecutive projects,
encoded from their own written post-mortems by the person who ran them. The
pattern was not designed; it was found by logging four failures and noticing
they were the same failure.

| Plan | What was committed | What was cheaper |
|---|---|---|
| **Contract-review hackathon** | The category, on day 0 — **6 days** to reverse | Opening a file already in the operator's own notes — **90 seconds**, measured |
| **Agentic memory engine** | GitHub Actions as the whole verification substrate — 706 lines written against it | One `git push` against the real remote |
| **Exam-prep product, live** | Marketing driving traffic through the funnel | One self-purchase, end to end |
| **A plan with a cost nobody stated** | An annual vendor contract | — **HOIST refuses to schedule this one** |

The first row is the headline: **six days of irreversibility, bought for a
ninety-second question.** Both figures are quoted from the log, not estimated
afterwards, and the provenance panel in the app says so per number.

---

## When it refuses

If any cost in a plan is undeclared, HOIST emits **no schedule**. Not a partial
one, not a best guess, not one with a warning banner.

> **HOIST declines to schedule this plan.**
> *1 fact has an undeclared cost. HOIST will not emit a reordered plan from a
> guess. A schedule you cannot check is worse than no schedule, because it looks
> like one.*

Refusing is a return value, not an error path. It is the single behaviour the
test suite exists to protect, and one bundled plan exists purely to exercise it.

It still analyses everything it *can* — refusing to schedule is not refusing to
think.

---

## The six findings

`inverted` (acted, then looked) · `absent` (never looked) · `ordered` (looked
first) · `not_worth_it` (the lookup genuinely costs more than being wrong) ·
`unknowable` (the fact does not exist until after the commitment — structural,
not a mistake) · `undeclared` (a cost was not stated).

Only `inverted` and `absent` contribute to the exposure total. A number that
counted the others would be bigger and would mean less.

## What the scheduler actually does

A **stable extraction**, not a topological re-sort: it moves the minimum it can
defend moving, because the operator wrote the original order for reasons the
tool cannot see. A lookup lifts only if its hard dependency edges still hold and
the fact is knowable at the new position. Otherwise it stays put and is reported
as blocked, **naming the steps that block it** — the claims audit cannot precede
writing the claims, and the tool says so rather than pretending otherwise.

The UI marks a step "lifted" only when its index actually *decreased*. A step
displaced one position later by somebody else's lift is not labelled as though
the scheduler acted on it. That distinction is enforced in code, because this is
the one screen where overstating what was done would be self-refuting.

---

## The receipt

[`ci/latest.json`](ci/latest.json) is machine-written by
[`scripts/receipt.mjs`](scripts/receipt.mjs). Before writing, it independently
re-derives every headline total from the exposure list and **verifies that every
hard dependency edge still holds in every emitted schedule** — and aborts rather
than emitting a receipt if either check fails.

```bash
npm install
npm test          # 18 tests
npm run typecheck
npm run receipt
npm run build     # -> docs/, which is what GitHub Pages serves
```

There is no model, no API key, no backend and no network call anywhere in this
project. The deployed page counts its own network requests after load, from the
browser's own `PerformanceResourceTiming`, and prints the number. It stays at 0.

---

## Where it breaks

[`docs/LIMITS.md`](docs/LIMITS.md). Briefly: it estimates nothing, it knows
nothing about your work, exposure is hours and not blame, and the corpus is one
person's practice rather than a validated dataset.

## Competitors, and why they are not

Change-management gates, deploy approvals, and "are you sure?" dialogs all sit
**in front of** the irreversible step. Every one of them accepts the plan's
ordering as given and adds friction at the worst moment. HOIST takes the
ordering itself as the thing that is wrong. That is a different artifact, not a
better dialog.

## Hackathon context

Built for **QuantumHacks 2026** (Devpost), event period 20 June – 20 August
2026. Competing for **Most Innovative Solution**.

Judged on Innovation 30% · Technical Implementation 30% · Impact 20% ·
Design & UX 10% · Presentation 10%.

## Licence

MIT.
