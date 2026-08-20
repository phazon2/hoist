/**
 * The corpus.
 *
 * Three of these are not illustrative examples. CONTRAPARTE, RESCIND and RUTA
 * are real projects, encoded from their own written post-mortems by the person
 * who ran them, across two overlapping weeks of August 2026. That is why the
 * tool exists at all: the pattern was found by logging those three failures and
 * noticing they were the same failure.
 *
 * UNDECLARED is the fourth, and it is CONSTRUCTED. It claims no provenance. It
 * is here because the refusal path needs a plan to refuse, and because a plan
 * with one cost nobody stated is the ordinary shape of a plan.
 *
 * Provenance is tracked per number. Where the log states a figure, `basis`
 * says "measured" and quotes it. Where the figure is the operator's own
 * after-the-fact estimate, `basis` says so. A screen about not confusing a
 * checked number with an assumed one cannot itself present them identically.
 */

import type { Plan } from './plan';

export const CONTRAPARTE: Plan = {
  id: 'contraparte',
  title: 'Contract-review tool, 8-day hackathon',
  source: 'Rep log 01 — Contraparte / AI Factory, 3–10 Aug 2026. Solo.',
  facts: [
    {
      id: 'crowding',
      label: 'In the reference event — same organiser, same judges, same rubric — contract review drew 15+ entries and produced zero winners.',
      lookupCost: 0.025,
      knowableFrom: 0,
      basis: 'measured — "Reading it cost one tool call... about ninety seconds"',
    },
    {
      id: 'claims-true',
      label: 'Do the factual claims in the submission match the shipped source?',
      lookupCost: 3,
      knowableFrom: 3,
      basis: 'measured — the adversarial audit found four false claims in one night',
    },
    {
      id: 'demo-is-deployed',
      label: 'Does the build being filmed match the build that is actually deployed?',
      lookupCost: 0.25,
      knowableFrom: 0,
      basis: 'estimated — one diff against the deployed source',
    },
  ],
  steps: [
    { id: 'read-brief', label: 'Read the hackathon brief', reversalCost: 0, commitsTo: [], requires: [] },
    {
      id: 'choose', label: 'Choose the category: contract review',
      reversalCost: 144, commitsTo: ['crowding'], requires: [],
      basis: 'measured — the choice was six days old and load-bearing for every downstream artifact',
    },
    { id: 'build', label: 'Build the app', reversalCost: 40, commitsTo: [], requires: ['choose'] },
    {
      id: 'write-claims', label: 'Write the submission copy and README',
      reversalCost: 8, commitsTo: ['claims-true'], requires: ['build'],
      basis: 'estimated — rewriting the submission, repo and deck',
    },
    {
      id: 'film', label: 'Film the demo video',
      reversalCost: 6, commitsTo: ['demo-is-deployed'], requires: ['build'],
      basis: 'estimated — one full re-shoot and re-cut',
    },
    {
      id: 'read-field-data', label: 'Open "Hackatons winners data" in Notion',
      reversalCost: 0, commitsTo: [], requires: [], looksUp: 'crowding',
    },
    {
      id: 'audit', label: 'Adversarial audit of our own claims',
      reversalCost: 0, commitsTo: [], requires: ['write-claims'], looksUp: 'claims-true',
    },
    { id: 'submit', label: 'Submit', reversalCost: 999, commitsTo: [], requires: ['film', 'audit'] },
  ],
};

export const RESCIND: Plan = {
  id: 'rescind',
  title: 'Agentic memory engine, 5-day hackathon',
  source: 'Rep log 02 — Rescind / CockroachDB × AWS, 14–18 Aug 2026. Solo.',
  facts: [
    {
      id: 'can-push',
      label: 'Can this session actually push to the target repo with this token?',
      lookupCost: 0.05,
      knowableFrom: 0,
      basis: 'estimated — one git push against the real remote',
    },
    {
      id: 'cascade-ceiling',
      label: 'At what closure size does the single-transaction retraction cascade stop committing?',
      lookupCost: 1.5,
      knowableFrom: 3,
      basis: 'measured — the sweep that found the 127-fact ceiling',
    },
    {
      id: 'operator-has-laptop',
      label: 'Does the operator actually have a laptop available this week?',
      lookupCost: 0.02,
      knowableFrom: 0,
      basis: 'estimated — one question',
    },
  ],
  steps: [
    { id: 'probe-net', label: 'Boundary probe: can we reach GitHub at all?', reversalCost: 0, commitsTo: [], requires: [] },
    {
      id: 'pick-substrate', label: 'Design GitHub Actions as the verification substrate',
      reversalCost: 12, commitsTo: ['can-push'], requires: [],
      basis: 'estimated — 706 lines written against a plan that could not run',
    },
    {
      id: 'write-checklist', label: 'Write the operator setup checklist',
      reversalCost: 1.5, commitsTo: ['operator-has-laptop'], requires: [],
      basis: 'estimated — the checklist was rewritten for phone-only',
    },
    { id: 'write-engine', label: 'Write schema, engine, agent and tests', reversalCost: 20, commitsTo: [], requires: ['pick-substrate'] },
    {
      id: 'try-push', label: 'Attempt the actual push',
      reversalCost: 0, commitsTo: [], requires: [], looksUp: 'can-push',
    },
    {
      id: 'ask-laptop', label: 'Ask the operator what hardware they have',
      reversalCost: 0, commitsTo: [], requires: [], looksUp: 'operator-has-laptop',
    },
    {
      id: 'bench', label: 'Benchmark the cascade until it breaks',
      reversalCost: 0, commitsTo: [], requires: ['write-engine'], looksUp: 'cascade-ceiling',
    },
    {
      id: 'publish-limit', label: 'Publish the ceiling in LIMITS.md',
      reversalCost: 2, commitsTo: ['cascade-ceiling'], requires: ['bench'],
      basis: 'estimated — restating a limit across README, docs and pitch',
    },
  ],
};

export const RUTA: Plan = {
  id: 'ruta',
  title: 'Exam-prep product, live with paying customers',
  source: 'Rep log 03 — Ruta PAES / Build with Gemini XPRIZE, 9–17 Aug 2026.',
  facts: [
    {
      id: 'tier',
      label: 'Which billing tier is the deployed project actually on?',
      lookupCost: 0.01,
      knowableFrom: 0,
      basis: 'measured — the tier label was printed in a screenshot already on screen',
    },
    {
      id: 'funnel-works',
      label: 'Does a real purchase actually deliver the product to the buyer?',
      lookupCost: 0.5,
      knowableFrom: 0,
      basis: 'measured — one self-purchase at CLP 9.990',
    },
    {
      id: 'one-prize-rule',
      label: 'Do the prize mechanics allow one project to win more than one prize?',
      lookupCost: 0.05,
      knowableFrom: 0,
      basis: 'measured — one page load of the rules',
    },
  ],
  steps: [
    {
      id: 'advise-portfolio', label: 'Recommend a single all-in project rather than a portfolio',
      reversalCost: 30, commitsTo: ['one-prize-rule'], requires: [],
      basis: 'estimated — rebuilding the portfolio strategy late',
    },
    {
      id: 'infer-tier', label: 'Infer the billing tier from a throughput metric',
      reversalCost: 8, commitsTo: ['tier'], requires: [],
      basis: 'estimated — the site was down for every visitor for an unknown period',
    },
    {
      id: 'build-marketing', label: 'Build and post the marketing assets',
      reversalCost: 10, commitsTo: ['funnel-works'], requires: [],
      basis: 'estimated — traffic driven through a funnel that did not deliver',
    },
    { id: 'read-rules', label: 'Read the prize mechanics', reversalCost: 0, commitsTo: [], requires: [], looksUp: 'one-prize-rule' },
    { id: 'read-label', label: 'Read the tier label in the console', reversalCost: 0, commitsTo: [], requires: [], looksUp: 'tier' },
    { id: 'buy-own', label: 'Buy your own product end to end', reversalCost: 0, commitsTo: [], requires: [], looksUp: 'funnel-works' },
  ],
};

/**
 * The refusal case. Constructed, not logged — the only plan here that is.
 *
 * Its shape is the ordinary one, though: "we'll figure out how bad it is if it
 * happens" is how most plans treat their most expensive commitment.
 */
export const UNDECLARED: Plan = {
  id: 'undeclared',
  title: 'A plan with a cost nobody stated (constructed)',
  source: 'Constructed, not logged — the only plan here that is. Its shape is the ordinary one.',
  facts: [
    {
      id: 'vendor-lockin',
      label: 'Does this vendor let us export our data if we leave?',
      lookupCost: null,
      knowableFrom: 0,
      basis: 'never stated — "we can check that later"',
    },
    {
      id: 'load',
      label: 'What does the service do above 10k concurrent users?',
      lookupCost: 4,
      knowableFrom: 1,
      basis: 'estimated — one load test',
    },
  ],
  steps: [
    {
      id: 'sign', label: 'Sign the annual vendor contract',
      reversalCost: 200, commitsTo: ['vendor-lockin'], requires: [],
      basis: 'estimated — migration off the platform',
    },
    { id: 'build', label: 'Build on the vendor SDK', reversalCost: 80, commitsTo: [], requires: ['sign'] },
    {
      id: 'launch', label: 'Launch to the full user base',
      reversalCost: 24, commitsTo: ['load'], requires: ['build'],
      basis: 'estimated — rollback and incident comms',
    },
    { id: 'loadtest', label: 'Run the load test', reversalCost: 0, commitsTo: [], requires: ['build'], looksUp: 'load' },
  ],
};

export const CORPUS: Plan[] = [CONTRAPARTE, RESCIND, RUTA, UNDECLARED];

export function planById(id: string): Plan {
  return CORPUS.find((p) => p.id === id) ?? CONTRAPARTE;
}
