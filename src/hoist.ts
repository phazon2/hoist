/**
 * HOIST — the scheduler.
 *
 * Every safety tool in this space GATES: it sits in front of the irreversible
 * action and asks "are you sure?". A confirmation dialog is a lookup nobody
 * performed, delegated to the person least able to perform it, at the only
 * instant they cannot afford it.
 *
 * HOIST does not gate. It REORDERS. It computes, for every fact the plan
 * commits to, the last instant at which learning that fact is still cheaper
 * than being wrong about it, and it lifts the lookup above that instant — or
 * it reports, precisely, that the plan's own dependencies make the lift
 * impossible.
 *
 * The rule is one line and it is not mine:
 *
 *   If the lookup that could change a decision is cheaper than the decision is
 *   to reverse, the lookup is mandatory and is not a delay.
 *
 * Nothing here estimates a cost. Both numbers in that comparison are declared
 * by the operator. An undeclared cost produces UNKNOWN, and UNKNOWN produces a
 * refusal rather than an assumption — because the entire failure this tool is
 * about is a missing lookup that felt like it had been done.
 */

import {
  type Plan,
  type Step,
  commitmentIndex,
  factById,
  lookupIndex,
  stepIndex,
} from './plan';

export type Finding =
  | 'ordered'        // the lookup already precedes the commitment. Nothing to do.
  | 'inverted'       // the lookup happens AFTER the commitment. This is the bug.
  | 'absent'         // the fact is never looked up at all.
  | 'not_worth_it'   // the lookup costs more than being wrong. Legitimately skippable.
  | 'unknowable'     // the fact cannot be known before the commitment. Structural.
  | 'undeclared';    // a cost was not stated. We decline to judge.

export interface Exposure {
  factId: string;
  factLabel: string;
  finding: Finding;
  /** Index of the first step that commits to the fact. -1 if none. */
  commitAt: number;
  commitLabel: string;
  /** Index of the step that performs the lookup. -1 if it never happens. */
  lookupAt: number;
  lookupCost: number | null;
  reversalCost: number | null;
  /**
   * Hours of irreversibility bought for nothing: what the commitment costs to
   * undo, minus what the lookup would have cost. Only defined when both costs
   * are declared and the ordering is wrong.
   */
  exposure: number | null;
  /** How many positions earlier the lookup needs to move. */
  liftBy: number;
  /** The step ids that block the lift, if it is blocked. */
  blockedBy: string[];
  note: string;
}

export interface Schedule {
  /** The reordered plan, or null when HOIST declines to produce one. */
  steps: Step[] | null;
  refused: boolean;
  refusalReason: string | null;
  exposures: Exposure[];
  /** Total declared hours of avoidable irreversibility. */
  totalExposure: number;
  /** Counts by finding, so the summary line never has to be recomputed. */
  tally: Record<Finding, number>;
}

/**
 * Earliest position a lookup step could occupy without breaking hard edges or
 * preceding the point at which the fact becomes knowable.
 */
function earliestLegalPosition(plan: Plan, lookupStep: Step, knowableFrom: number): number {
  let floor = Math.max(0, knowableFrom);
  for (const req of lookupStep.requires) {
    const i = stepIndex(plan, req);
    if (i >= 0) floor = Math.max(floor, i + 1);
  }
  return floor;
}

function blockers(plan: Plan, lookupStep: Step, target: number): string[] {
  const out: string[] = [];
  for (const req of lookupStep.requires) {
    const i = stepIndex(plan, req);
    if (i >= target) out.push(req);
  }
  return out;
}

export function analyse(plan: Plan): Schedule {
  const exposures: Exposure[] = [];

  for (const fact of plan.facts) {
    const commitAt = commitmentIndex(plan, fact.id);
    const lookupAt = lookupIndex(plan, fact.id);
    const commitStep = commitAt >= 0 ? plan.steps[commitAt] : null;
    const reversalCost = commitStep ? commitStep.reversalCost : null;
    const lookupCost = fact.lookupCost;

    const base = {
      factId: fact.id,
      factLabel: fact.label,
      commitAt,
      commitLabel: commitStep ? commitStep.label : '—',
      lookupAt,
      lookupCost,
      reversalCost,
      exposure: null as number | null,
      liftBy: 0,
      blockedBy: [] as string[],
    };

    // No commitment: the fact is not load-bearing in this plan at all.
    if (commitAt < 0) {
      exposures.push({
        ...base,
        finding: 'ordered',
        note: 'No step in this plan commits to this fact, so nothing rides on when you learn it.',
      });
      continue;
    }

    // A cost nobody stated. We refuse to judge rather than assume a default —
    // assuming "cheap" is how the original mistake gets made.
    if (lookupCost === null || reversalCost === null) {
      exposures.push({
        ...base,
        finding: 'undeclared',
        note:
          lookupCost === null && reversalCost === null
            ? 'Neither the lookup cost nor the reversal cost was stated. HOIST will not guess either one.'
            : lookupCost === null
              ? 'The lookup cost was not stated. Assuming it is cheap is the exact error this tool exists to catch.'
              : 'The reversal cost of the committing step was not stated, so there is nothing to compare against.',
      });
      continue;
    }

    // Structural: the fact simply is not knowable before the commitment.
    if (fact.knowableFrom > commitAt) {
      exposures.push({
        ...base,
        finding: 'unknowable',
        note:
          `This fact does not exist until step ${fact.knowableFrom + 1}, which is after the ` +
          `commitment at step ${commitAt + 1}. The ordering is not a mistake; the plan is ` +
          `structurally forced to commit while uninformed. That is worth knowing on its own.`,
      });
      continue;
    }

    // The rule.
    if (lookupCost >= reversalCost) {
      exposures.push({
        ...base,
        finding: 'not_worth_it',
        note:
          `Looking this up costs ${lookupCost}h and being wrong costs ${reversalCost}h. ` +
          `The lookup is not mandatory. Skipping it is a defensible decision rather than an ` +
          `oversight — and stating that is the point.`,
      });
      continue;
    }

    const exposure = reversalCost - lookupCost;

    if (lookupAt < 0) {
      exposures.push({
        ...base,
        finding: 'absent',
        exposure,
        liftBy: commitAt,
        note:
          `Never looked up. The commitment at step ${commitAt + 1} costs ${reversalCost}h to ` +
          `reverse; learning this first costs ${lookupCost}h. ${exposure}h of irreversibility ` +
          `was bought for nothing.`,
      });
      continue;
    }

    if (lookupAt < commitAt) {
      exposures.push({
        ...base,
        finding: 'ordered',
        note: `Already looked up at step ${lookupAt + 1}, before the commitment at step ${
          commitAt + 1
        }. This is the shape you want.`,
      });
      continue;
    }

    // The bug: acted, then looked.
    const lookupStep = plan.steps[lookupAt];
    const floor = earliestLegalPosition(plan, lookupStep, fact.knowableFrom);
    const blocked = blockers(plan, lookupStep, commitAt);
    exposures.push({
      ...base,
      finding: 'inverted',
      exposure,
      liftBy: lookupAt - commitAt,
      blockedBy: blocked,
      note:
        `Looked up at step ${lookupAt + 1}, ${lookupAt - commitAt} steps AFTER the commitment ` +
        `at step ${commitAt + 1}. ${exposure}h of irreversibility was bought for a ${lookupCost}h ` +
        `question. ` +
        (blocked.length
          ? `It cannot be lifted above the commitment: ${blocked.join(', ')} must come first.`
          : `It can be lifted to position ${floor + 1} with no dependency broken.`),
    });
  }

  const tally: Record<Finding, number> = {
    ordered: 0, inverted: 0, absent: 0, not_worth_it: 0, unknowable: 0, undeclared: 0,
  };
  for (const e of exposures) tally[e.finding]++;

  const totalExposure = exposures.reduce((a, e) => a + (e.exposure ?? 0), 0);

  // The refusal. If any cost in the plan is undeclared, HOIST will not emit a
  // reordered plan at all — a schedule computed from a guessed cost is exactly
  // the artifact that makes an unexamined decision feel examined.
  if (tally.undeclared > 0) {
    return {
      steps: null,
      refused: true,
      refusalReason:
        `${tally.undeclared} ${tally.undeclared === 1 ? 'fact has' : 'facts have'} an undeclared ` +
        `cost. HOIST will not emit a reordered plan from a guess. A schedule you cannot check is ` +
        `worse than no schedule, because it looks like one.`,
      exposures,
      totalExposure,
      tally,
    };
  }

  return {
    steps: reorder(plan, exposures),
    refused: false,
    refusalReason: null,
    exposures,
    totalExposure,
    tally,
  };
}

/**
 * Lift every liftable inverted lookup above its commitment, preserving all hard
 * edges and the relative order of everything else. A stable extraction rather
 * than a full topological re-sort: the operator wrote this order for reasons
 * the tool cannot see, so it moves the minimum it can defend moving.
 */
export function reorder(plan: Plan, exposures: Exposure[]): Step[] {
  const moves = exposures
    .filter((e) => e.finding === 'inverted' && e.blockedBy.length === 0 && e.lookupAt >= 0)
    .sort((a, b) => a.commitAt - b.commitAt);

  const out = plan.steps.slice();
  for (const m of moves) {
    const from = out.findIndex((s) => s.looksUp === m.factId);
    if (from < 0) continue;
    const commitPos = out.findIndex((s) => s.commitsTo.includes(m.factId));
    if (commitPos < 0 || from < commitPos) continue;
    const fact = factById(plan, m.factId);
    const lookupStep = out[from];
    let floor = Math.max(0, fact ? fact.knowableFrom : 0);
    for (const req of lookupStep.requires) {
      const i = out.findIndex((s) => s.id === req);
      if (i >= 0 && i < from) floor = Math.max(floor, i + 1);
    }
    const target = Math.min(commitPos, Math.max(floor, 0));
    out.splice(from, 1);
    out.splice(target, 0, lookupStep);
  }
  return out;
}
