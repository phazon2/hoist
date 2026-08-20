/**
 * Writes ci/latest.json.
 *
 * Records what this run OBSERVED, not what the tests CLAIM. Those are
 * different sentences. Read this script before you trust the file it writes.
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TMP = '.receipt-bundle.mjs';
await build({ entryPoints: ['src/index.ts'], bundle: true, format: 'esm', platform: 'node', outfile: TMP, logLevel: 'warning' });
const m = await import('./../' + TMP);
rmSync(TMP, { force: true });

const sh = (c) => { try { return execSync(c, { encoding: 'utf8' }).trim(); } catch { return null; } };

const plans = m.CORPUS.map((p) => {
  const s = m.analyse(p);

  // Independent re-derivation of the headline: sum the defensible exposures
  // straight off the exposure list rather than trusting the field. If these
  // disagree the receipt is not written.
  const recomputed = s.exposures.reduce((a, e) => a + (e.exposure ?? 0), 0);
  if (Math.abs(recomputed - s.totalExposure) > 1e-9) {
    console.error(`receipt aborted: total mismatch on ${p.id}`);
    process.exit(1);
  }

  // Every hard edge in an emitted schedule must still hold.
  let edgesHold = true;
  if (s.steps) {
    const pos = new Map(s.steps.map((st, i) => [st.id, i]));
    for (const st of s.steps) {
      for (const r of st.requires) {
        if (pos.has(r) && pos.get(r) >= pos.get(st.id)) edgesHold = false;
      }
    }
  }
  if (!edgesHold) { console.error(`receipt aborted: broken dependency edge in ${p.id}`); process.exit(1); }

  return {
    id: p.id,
    title: p.title,
    source: p.source,
    steps: p.steps.length,
    facts: p.facts.length,
    refused: s.refused,
    refusal_reason: s.refusalReason,
    total_exposure_hours: Number(s.totalExposure.toFixed(6)),
    tally: s.tally,
    dependency_edges_hold: edgesHold,
    exposures: s.exposures.map((e) => ({
      fact: e.factId,
      finding: e.finding,
      lookup_cost_hours: e.lookupCost,
      reversal_cost_hours: e.reversalCost,
      exposure_hours: e.exposure,
      committed_at_step: e.commitAt < 0 ? null : e.commitAt + 1,
      looked_up_at_step: e.lookupAt < 0 ? null : e.lookupAt + 1,
      blocked_by: e.blockedBy,
    })),
    lifted_steps: s.steps
      ? s.steps
          .map((st, i) => ({ id: st.id, from: p.steps.findIndex((x) => x.id === st.id) + 1, to: i + 1 }))
          .filter((x) => x.to < x.from)
      : null,
  };
});

const receipt = {
  what_this_is:
    'Records what this run observed, not what the tests claim. Read scripts/receipt.mjs before trusting it.',
  generated_at_utc: new Date().toISOString(),
  commit: sh('git rev-parse HEAD'),
  node: process.version,
  invariant:
    'HOIST emits no schedule when any cost in the plan is undeclared. One plan in the corpus exists to exercise exactly that.',
  plans,
};

mkdirSync('ci', { recursive: true });
writeFileSync('ci/latest.json', JSON.stringify(receipt, null, 2) + '\n');
const refused = plans.filter((p) => p.refused).length;
console.log(`receipt -> ${plans.length} plans, ${refused} refused, ` +
  `${plans.reduce((a, p) => a + p.total_exposure_hours, 0).toFixed(2)}h total exposure`);
