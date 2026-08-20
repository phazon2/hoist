## Every safety tool gates the irreversible action. HOIST reorders the plan around it.

## Inspiration

A confirmation dialog is a lookup nobody performed, handed to the person least able to perform it, at the one instant they cannot afford it. Change-management gates, deploy approvals, "are you sure?" — every one of them accepts the plan's ordering as given and adds friction at the worst possible moment.

HOIST treats the **ordering itself** as the thing that is wrong.

It came out of logging three consecutive project post-mortems and noticing they were the same failure three times: an expensive, hard-to-reverse action taken *before* a cheap, reversible lookup that would have changed it. Not missing information — **inverted ordering** between the cost of committing and the cost of checking.

## The rule, and it is one line

> If the lookup that could change a decision is cheaper than the decision is to reverse, the lookup is mandatory and is not a delay.

That is not a heuristic. It is a comparison between two numbers, **both declared by whoever wrote the plan**. HOIST estimates neither. It has no model of your work, no notion of difficulty, and nothing to infer from. It compares two figures you supplied and notices which one came first in time.

## What it does

Give it a plan: ordered steps, each with a cost to undo, each committing to facts; and facts, each with a cost to learn and the earliest point it is knowable. HOIST returns, per fact, one of six findings — and then either lifts the mis-ordered lookups above their commitments, or refuses.

**Three of the four bundled plans are real projects**, encoded from their own written post-mortems by the person who ran them across two overlapping weeks. Not illustrative examples — the actual failures the tool was derived from. The fourth is **constructed**: it claims no provenance and exists only to exercise the refusal.

The headline row is an eight-day hackathon:

> The category was chosen on day zero — **6 days** to reverse. The field data that would have changed it was sitting in the operator's own notes. Reading it cost **90 seconds**. It was opened on day six.
>
> **6.4 days of irreversibility, bought for nothing.**

Both of those figures are quoted from the log rather than estimated afterwards, and the app's provenance panel says so per number — because a figure somebody measured and a figure somebody guessed must not look alike on a screen that is about exactly that confusion.

## When it refuses

If a cost the rule actually reaches is undeclared — the lookup cost of a fact some step commits to, or the reversal cost of the step that first commits to it — HOIST emits no schedule. Not a partial one, not a best guess, not one with a warning banner. A blank cost that no comparison touches is not load-bearing and does not trigger it.

> ### HOIST declines to schedule this plan.
> *1 fact has an undeclared cost. HOIST will not emit a reordered plan from a guess. A schedule you cannot check is worse than no schedule, because it looks like one.*

Refusing is a return value, not an error path. It is the single behaviour the test suite exists to protect, and one of the four bundled plans exists purely to exercise it. It still analyses everything it *can* — refusing to schedule is not refusing to think.

## The six findings

`inverted` (acted, then looked) · `absent` (never looked, and it was cheaper than being wrong) · `ordered` (nothing to fix — the lookup came first, or no step commits to the fact) · `not_worth_it` (the lookup costs at least as much as being wrong, so skipping it is defensible and the tool says so) · `unknowable` (the fact does not exist until after the commitment — structural, not a mistake) · `undeclared`.

**Only `inverted` and `absent` contribute to the exposure total.** A number that counted the others would be larger and would mean less.

## How I built it

A **stable extraction**, not a topological re-sort. The operator wrote the original order for reasons the tool cannot see, so it moves the minimum it can defend moving. A lookup lifts only if its hard dependency edges still hold at the new position and the fact is knowable there. Otherwise it stays put and is reported as blocked, **naming the steps that block it** — the claims audit cannot precede writing the claims, and the tool says so rather than pretending otherwise.

Stages: plan/fact model with per-number provenance → commitment and lookup indexing → the six-way finding classifier → the mandatory-lookup comparison → dependency-safe lift → refusal gate → receipt.

No model. No API key. No backend. No network call. The deployed page counts its own network requests after load, from the browser's own `PerformanceResourceTiming`, and prints the number. It stays at **0**.

## Challenges I ran into

**The UI told a lie the scheduler had not.** The first version tagged a step "lifted" whenever it was a flagged lookup — including the ones the scheduler had explicitly *refused* to move because a dependency blocked them. On the one screen whose entire subject is not overstating what was checked, that was self-refuting. It now marks a step lifted only when its index actually *decreased*, and a blocked lookup carries a "could not be lifted" tag instead.

**Then it overstated the other way.** Restricting to "index changed" tagged every step *displaced* by a lift as though the scheduler had acted on it. A lifted step's index goes down; a displaced step's goes up. That distinction is now enforced in code.

Both bugs were the same bug: an artifact claiming credit for work it had not done. Which is the failure the whole project is about, appearing inside the project.

## The receipt

`ci/latest.json` is machine-written by `scripts/receipt.mjs`. Before writing, it **verifies that every hard dependency edge still holds in every emitted schedule** — a check on the output that nothing in `src/` performs on itself — and aborts rather than emitting a receipt if any edge is broken. It also re-sums the headline total off the exposure list, but with the same reduction the library used, so that half is a transcription check rather than an independent derivation. Read the script before you trust the receipt.

18 tests, typecheck clean, no network in the suite.

## The claims audit

After both projects were built, 40 agents ran three hostile lenses over each, with every finding independently re-verified against the shipped source. It confirmed that this README had called the corpus "four real failures" when the fourth is constructed, and that the receipt claimed an "independent" re-derivation that actually re-used the library's own reduction. Both are corrected above rather than quietly. A tool about not overstating what you checked has no business overstating what it checked.

## What I learned

That "add a confirmation step" and "move the question earlier" look like the same intervention and are not remotely the same intervention. The first spends the operator's attention at the moment it is scarcest. The second spends nothing, because the lookup was always going to be cheap — that was the whole premise.

## What it does not do

It estimates nothing. It knows nothing about your work. Exposure is hours, not money and not blame — it does not claim the outcome would have been different, only that the question was cheaper than the decision and came after it. And the corpus is three real plans by one person plus one constructed case: honest, and not a validated dataset. All of that is in `docs/LIMITS.md`.
