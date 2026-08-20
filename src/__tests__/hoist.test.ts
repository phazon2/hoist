/**
 * The invariant this suite exists to protect:
 *
 *   HOIST never emits a schedule from a cost nobody stated.
 *
 * Everything else here is arithmetic that can be checked by hand. That one is
 * the claim, and it is the one that would be quietly convenient to break.
 */
import { describe, expect, it } from 'vitest';
import { analyse, reorder, type Finding } from '../hoist';
import { CONTRAPARTE, RESCIND, RUTA, UNDECLARED, CORPUS } from '../corpus';
import { commitmentIndex, lookupIndex, type Plan } from '../plan';

const find = (p: Plan, factId: string) => {
  const e = analyse(p).exposures.find((x) => x.factId === factId);
  if (!e) throw new Error('no exposure for ' + factId);
  return e;
};

describe('the refusal', () => {
  it('emits no schedule at all when any cost is undeclared', () => {
    const s = analyse(UNDECLARED);
    expect(s.refused).toBe(true);
    expect(s.steps).toBeNull();
    expect(s.refusalReason).toMatch(/will not emit a reordered plan from a guess/);
  });

  it('still reports what it could work out, while refusing to schedule', () => {
    const s = analyse(UNDECLARED);
    expect(s.exposures.length).toBe(UNDECLARED.facts.length);
    expect(find(UNDECLARED, 'vendor-lockin').finding).toBe<Finding>('undeclared');
    // The declared one is still analysed — refusing to schedule is not refusing
    // to think.
    expect(find(UNDECLARED, 'load').finding).toBe<Finding>('inverted');
  });

  it('never assumes a missing cost is cheap', () => {
    const e = find(UNDECLARED, 'vendor-lockin');
    expect(e.exposure).toBeNull();
    expect(e.lookupCost).toBeNull();
  });
});

describe('the rule: cheap lookup before expensive commitment', () => {
  it('finds the inversion that cost six days for a ninety-second question', () => {
    const e = find(CONTRAPARTE, 'crowding');
    expect(e.finding).toBe<Finding>('inverted');
    expect(e.reversalCost).toBe(144);
    expect(e.lookupCost).toBe(0.025);
    expect(e.exposure).toBeCloseTo(143.975, 6);
    // committed at step 2 (index 1), looked up at step 6 (index 5)
    expect(e.commitAt).toBe(1);
    expect(e.lookupAt).toBe(5);
    expect(e.liftBy).toBe(4);
  });

  it('does not flag a lookup that is genuinely not worth doing', () => {
    // Publishing the ceiling costs 2h to restate; measuring it costs 1.5h. The
    // lookup IS cheaper, so this must be inverted, not excused.
    const e = find(RESCIND, 'cascade-ceiling');
    expect(e.lookupCost!).toBeLessThan(e.reversalCost!);
  });

  it('reports a fact that is not knowable in time as structural, not a mistake', () => {
    const p: Plan = {
      id: 't', title: 't', source: 't',
      facts: [{ id: 'f', label: 'f', lookupCost: 0.1, knowableFrom: 3 }],
      steps: [
        { id: 'a', label: 'a', reversalCost: 10, commitsTo: ['f'], requires: [] },
        { id: 'b', label: 'b', reversalCost: 0, commitsTo: [], requires: [] },
        { id: 'c', label: 'c', reversalCost: 0, commitsTo: [], requires: [] },
        { id: 'd', label: 'd', reversalCost: 0, commitsTo: [], requires: [], looksUp: 'f' },
      ],
    };
    expect(find(p, 'f').finding).toBe<Finding>('unknowable');
  });

  it('calls a lookup not worth doing when it costs more than being wrong', () => {
    const p: Plan = {
      id: 't', title: 't', source: 't',
      facts: [{ id: 'f', label: 'f', lookupCost: 40, knowableFrom: 0 }],
      steps: [
        { id: 'a', label: 'a', reversalCost: 2, commitsTo: ['f'], requires: [] },
        { id: 'b', label: 'b', reversalCost: 0, commitsTo: [], requires: [], looksUp: 'f' },
      ],
    };
    const e = find(p, 'f');
    expect(e.finding).toBe<Finding>('not_worth_it');
    expect(e.exposure).toBeNull();
  });

  it('flags a mandatory lookup that never happens at all', () => {
    const p: Plan = {
      id: 't', title: 't', source: 't',
      facts: [{ id: 'f', label: 'f', lookupCost: 0.5, knowableFrom: 0 }],
      steps: [{ id: 'a', label: 'a', reversalCost: 30, commitsTo: ['f'], requires: [] }],
    };
    const e = find(p, 'f');
    expect(e.finding).toBe<Finding>('absent');
    expect(e.exposure).toBe(29.5);
  });

  it('is content when the lookup already precedes the commitment', () => {
    const p: Plan = {
      id: 't', title: 't', source: 't',
      facts: [{ id: 'f', label: 'f', lookupCost: 0.5, knowableFrom: 0 }],
      steps: [
        { id: 'b', label: 'b', reversalCost: 0, commitsTo: [], requires: [], looksUp: 'f' },
        { id: 'a', label: 'a', reversalCost: 30, commitsTo: ['f'], requires: [] },
      ],
    };
    expect(find(p, 'f').finding).toBe<Finding>('ordered');
    expect(find(p, 'f').exposure).toBeNull();
  });
});

describe('lifting', () => {
  it('moves the lookup above its commitment', () => {
    const s = analyse(CONTRAPARTE);
    expect(s.refused).toBe(false);
    const before = lookupIndex(CONTRAPARTE, 'crowding');
    const after = s.steps!.findIndex((x) => x.looksUp === 'crowding');
    const commitAfter = s.steps!.findIndex((x) => x.commitsTo.includes('crowding'));
    expect(before).toBeGreaterThan(commitmentIndex(CONTRAPARTE, 'crowding'));
    expect(after).toBeLessThan(commitAfter);
  });

  it('never breaks a hard dependency edge', () => {
    for (const plan of CORPUS) {
      const s = analyse(plan);
      if (!s.steps) continue;
      const pos = new Map(s.steps.map((st, i) => [st.id, i]));
      for (const st of s.steps) {
        for (const req of st.requires) {
          if (!pos.has(req)) continue;
          expect(pos.get(req)!).toBeLessThan(pos.get(st.id)!);
        }
      }
    }
  });

  it('keeps every step — lifting reorders, it never drops work', () => {
    for (const plan of CORPUS) {
      const s = analyse(plan);
      if (!s.steps) continue;
      expect(s.steps.length).toBe(plan.steps.length);
      expect(new Set(s.steps.map((x) => x.id)).size).toBe(plan.steps.length);
    }
  });

  it('is idempotent — a lifted plan has nothing left to lift', () => {
    for (const plan of CORPUS) {
      const s = analyse(plan);
      if (!s.steps) continue;
      const once: Plan = { ...plan, steps: s.steps };
      const twice = analyse(once);
      expect(twice.exposures.filter((e) => e.finding === 'inverted' && !e.blockedBy.length))
        .toHaveLength(0);
    }
  });

  it('will not lift a lookup above a step it genuinely depends on', () => {
    // The claims audit cannot precede writing the claims.
    const e = find(CONTRAPARTE, 'claims-true');
    expect(e.finding).toBe<Finding>('inverted');
    expect(e.blockedBy).toContain('write-claims');
    const s = analyse(CONTRAPARTE);
    const pos = new Map(s.steps!.map((st, i) => [st.id, i]));
    expect(pos.get('write-claims')!).toBeLessThan(pos.get('audit')!);
  });
});

describe('totals', () => {
  it('sums only the exposures it can defend', () => {
    const s = analyse(CONTRAPARTE);
    const summed = s.exposures.reduce((a, e) => a + (e.exposure ?? 0), 0);
    expect(s.totalExposure).toBeCloseTo(summed, 9);
    for (const e of s.exposures) {
      if (e.exposure !== null) {
        expect(['inverted', 'absent']).toContain(e.finding);
      }
    }
  });

  it('the tally accounts for every fact exactly once', () => {
    for (const plan of CORPUS) {
      const s = analyse(plan);
      const total = Object.values(s.tally).reduce((a, b) => a + b, 0);
      expect(total).toBe(plan.facts.length);
    }
  });
});

describe('the corpus is well formed', () => {
  it('every fact a step commits to exists, and every requirement resolves', () => {
    for (const plan of CORPUS) {
      const factIds = new Set(plan.facts.map((f) => f.id));
      const stepIds = new Set(plan.steps.map((s) => s.id));
      for (const s of plan.steps) {
        for (const c of s.commitsTo) expect(factIds.has(c)).toBe(true);
        for (const r of s.requires) expect(stepIds.has(r)).toBe(true);
        if (s.looksUp) expect(factIds.has(s.looksUp)).toBe(true);
      }
    }
  });

  it('every declared cost carries its provenance', () => {
    for (const plan of CORPUS) {
      for (const f of plan.facts) {
        if (f.lookupCost !== null) expect(typeof f.basis).toBe('string');
      }
      for (const s of plan.steps) {
        if (s.reversalCost !== null && s.reversalCost > 0 && s.commitsTo.length) {
          expect(typeof s.basis).toBe('string');
        }
      }
    }
  });
});
