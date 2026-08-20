/**
 * HOIST — types for a plan and the facts it commits to.
 *
 * A plan is an ordered list of steps. Some steps are cheap to undo and some
 * are not. Some steps depend on facts that could have been looked up first.
 *
 * The whole instrument rests on one comparison, and it is deliberately a
 * comparison between two numbers the operator declares rather than two numbers
 * a model estimates. Nothing here infers a cost. If you did not state it, it is
 * UNKNOWN, and an UNKNOWN is a refusal — not a default.
 */

export type Hours = number;

/** A fact you could go and learn. */
export interface Fact {
  id: string;
  label: string;
  /**
   * What it costs to learn this now. `null` means you have not said, and the
   * scheduler will decline to reason about it rather than assume cheap.
   */
  lookupCost: Hours | null;
  /**
   * Index of the earliest step at which this fact is knowable at all. A fact
   * that only exists once the build is running cannot be lifted above it, and
   * saying so is different from saying the lookup is expensive.
   */
  knowableFrom: number;
  /**
   * Where lookupCost came from. Rendered next to the number, because a figure
   * somebody measured and a figure somebody guessed should never look alike on
   * a screen that is about not confusing those two things.
   */
  basis?: string;
}

export interface Step {
  id: string;
  label: string;
  /**
   * What it would cost to undo this step after taking it. `null` = not stated.
   * This is the expensive side of the comparison.
   */
  reversalCost: Hours | null;
  /** Facts this step commits to — it cannot be un-decided without paying the cost. */
  commitsTo: string[];
  /** Step ids that must precede this one no matter what. Hard edges. */
  requires: string[];
  /** True when this step IS the act of looking a fact up. */
  looksUp?: string;
  /** Where reversalCost came from. See Fact.basis. */
  basis?: string;
}

export interface Plan {
  id: string;
  title: string;
  source: string;
  /** Ordered as it actually happened. Index is the position in time. */
  steps: Step[];
  facts: Fact[];
}

export function factById(plan: Plan, id: string): Fact | undefined {
  return plan.facts.find((f) => f.id === id);
}

export function stepIndex(plan: Plan, id: string): number {
  return plan.steps.findIndex((s) => s.id === id);
}

/** Where in the plan a fact actually gets looked up, or -1 if it never does. */
export function lookupIndex(plan: Plan, factId: string): number {
  return plan.steps.findIndex((s) => s.looksUp === factId);
}

/** The first step that commits to a fact, or -1. */
export function commitmentIndex(plan: Plan, factId: string): number {
  return plan.steps.findIndex((s) => s.commitsTo.includes(factId));
}
