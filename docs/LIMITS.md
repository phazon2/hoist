# What HOIST does not do

## It does not estimate anything

Both numbers in every comparison are **declared by whoever wrote the plan**.
HOIST does not look at your work, does not infer difficulty, and has no model
of anything. It compares two figures you supplied and notices which one came
first in time.

That is a smaller claim than it sounds, and it is the whole product. The
failure this tool is about is not "we could not estimate the cost." It is
"we never asked, and acting felt like asking."

## Undeclared means refused

If a cost the rule actually reaches is missing — the lookup cost of a fact some
step commits to, or the reversal cost of the step that first commits to it —
HOIST emits **no schedule at all**. Not a
partial one, not a best guess, not a schedule with a warning banner.

A schedule you cannot check is worse than no schedule, because it looks like
one. This is the single behaviour the test suite exists to protect, and one of
the four bundled plans exists purely to exercise it.

## What the findings mean, precisely

| Finding | Meaning |
|---|---|
| `inverted` | The lookup happened after the commitment. This is the bug. |
| `absent` | The lookup never happened at all, and it was cheaper than being wrong. |
| `ordered` | Nothing to do: either the lookup already preceded the commitment, or no step in this plan commits to the fact at all. |
| `not_worth_it` | The lookup costs at least as much as being wrong. Skipping it is defensible, and saying so is the point. |
| `unknowable` | The fact does not exist until after the commitment. The plan is structurally forced to commit while uninformed — not a mistake, but worth knowing. |
| `undeclared` | A cost was not stated. HOIST declines to judge. |

Only `inverted` and `absent` contribute to the exposure total. A number that
included the others would be larger and would mean less.

## Lifting is conservative

The scheduler performs a **stable extraction**, not a topological re-sort. It
moves the minimum it can defend moving, because the operator wrote the original
order for reasons the tool cannot see. A lookup is lifted only when:

- its hard dependency edges still hold at the new position, and
- the fact is knowable at that position.

Otherwise it stays where it is and is reported as blocked, naming the steps
that block it. The UI marks a step "lifted" only when its index actually
decreased — a step displaced one position later by somebody else's lift is not
labelled as though the scheduler acted on it.

## Exposure is hours, not money, and not blame

`exposure = reversal cost of the commitment − cost of the lookup`. It is the
irreversibility that was bought without buying any information. It is not a
prediction, not a probability, and not a claim that the outcome would have been
different — only that the question was cheaper than the decision, and came
after it.

## The corpus is real, and that is also a limit

Three of the four bundled plans are encoded from written post-mortems of real
projects by the person who ran them, across two overlapping weeks. The fourth
claims no provenance at all — it is constructed, and exists purely to exercise
the refusal described above. That makes the real three honest and it makes them
**one person's practice**. Nothing here is validated across teams, industries,
or plan sizes. The provenance panel names, per number, whether the figure was
measured at the time or estimated afterwards, and you should read it before
treating any total as a measurement.
