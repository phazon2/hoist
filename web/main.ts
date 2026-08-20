/**
 * HOIST — the surface.
 *
 * Renders only. Every figure comes from `analyse()`, which compares numbers the
 * plan declares and refuses when one is missing. Nothing here computes a cost,
 * because a tool about not assuming things must not assume anything.
 */

import {
  analyse,
  CORPUS,
  planById,
  type Exposure,
  type Finding,
  type Plan,
  type Schedule,
  type Step,
} from '../src/index';

const $ = <T extends HTMLElement>(s: string): T => document.querySelector(s) as T;
const plansEl = $<HTMLDivElement>('#plans');
const sourceEl = $<HTMLParagraphElement>('#source');
const outEl = $<HTMLElement>('#result');

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Hours, rendered the way a person would say them. */
function hrs(h: number): string {
  if (h === 0) return '0';
  if (h < 0.017) return `${Math.round(h * 3600)}s`;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h % 1 === 0 ? h : h.toFixed(2).replace(/\.?0+$/, '')} h`;
  const d = h / 24;
  return `${d % 1 === 0 ? d : d.toFixed(1)} days`;
}

const FINDING: Record<Finding, { label: string; cls: string }> = {
  inverted: { label: 'ACTED, THEN LOOKED', cls: 'f-inv' },
  absent: { label: 'NEVER LOOKED', cls: 'f-abs' },
  ordered: { label: 'LOOKED FIRST', cls: 'f-ok' },
  not_worth_it: { label: 'NOT WORTH IT', cls: 'f-nwi' },
  unknowable: { label: 'NOT KNOWABLE IN TIME', cls: 'f-unk' },
  undeclared: { label: 'COST NOT STATED', cls: 'f-und' },
};

function timeline(plan: Plan, s: Schedule, steps: Step[], title: string, lifted: boolean): string {
  const invertedFacts = new Set(
    s.exposures.filter((e) => e.finding === 'inverted' || e.finding === 'absent').map((e) => e.factId),
  );
  // Which steps ACTUALLY changed position. Tagging a step "lifted" because it
  // is a lookup that was flagged — rather than because it moved — would print a
  // claim the schedule does not support, on the one screen that is about
  // exactly that mistake. Blocked lookups stay put and must look like it.
  const wasMoved = new Set<string>();
  if (lifted) {
    const before = new Map(plan.steps.map((st, i) => [st.id, i]));
    // Only a step whose index went DOWN was actually lifted. A step that ends
    // up one position later was displaced by the lift, not subject to it, and
    // labelling it "lifted" would overstate what the scheduler did.
    steps.forEach((st, i) => { const b = before.get(st.id); if (b !== undefined && i < b) wasMoved.add(st.id); });
  }
  return `
    <div class="tl">
      <h3>${esc(title)}</h3>
      <ol class="steps">
        ${steps
          .map((st, i) => {
            const isLookup = !!st.looksUp;
            const hot = isLookup ? invertedFacts.has(st.looksUp!) : st.commitsTo.some((c) => invertedFacts.has(c));
            const cls = [
              isLookup ? 'lookup' : '',
              st.commitsTo.length ? 'commits' : '',
              hot ? 'hot' : '',
              wasMoved.has(st.id) ? 'moved' : '',
            ].filter(Boolean).join(' ');
            return `<li class="${cls}">
              <span class="i">${i + 1}</span>
              <span class="lbl">${esc(st.label)}</span>
              <span class="tags">
                ${isLookup ? '<em class="t-look">lookup</em>' : ''}
                ${st.commitsTo.length ? `<em class="t-commit">commits &middot; ${st.reversalCost === null ? 'cost not stated' : hrs(st.reversalCost) + ' to undo'}</em>` : ''}
                ${isLookup && lifted && !wasMoved.has(st.id) && hot ? '<em class="t-block">could not be lifted</em>' : ''}
              </span>
            </li>`;
          })
          .join('')}
      </ol>
    </div>`;
}

function exposureRow(e: Exposure): string {
  const f = FINDING[e.finding];
  return `
    <li class="ex ${f.cls}">
      <div class="exhead">
        <span class="badge ${f.cls}">${f.label}</span>
        ${e.exposure !== null ? `<span class="expo">${hrs(e.exposure)}</span>` : ''}
      </div>
      <p class="q">${esc(e.factLabel)}</p>
      <div class="nums">
        <span><b>lookup</b> ${e.lookupCost === null ? '—' : hrs(e.lookupCost)}</span>
        <span><b>undo</b> ${e.reversalCost === null ? '—' : hrs(e.reversalCost)}</span>
        <span><b>committed at</b> ${e.commitAt < 0 ? '—' : 'step ' + (e.commitAt + 1)}</span>
        <span><b>looked up at</b> ${e.lookupAt < 0 ? 'never' : 'step ' + (e.lookupAt + 1)}</span>
      </div>
      <p class="note">${esc(e.note)}</p>
    </li>`;
}

function provenance(plan: Plan): string {
  const rows = [
    ...plan.facts.filter((f) => f.basis).map((f) => ({ what: `lookup: ${f.label}`, basis: f.basis! })),
    ...plan.steps.filter((s) => s.basis).map((s) => ({ what: `undo: ${s.label}`, basis: s.basis! })),
  ];
  if (!rows.length) return '';
  return `
    <details class="prov">
      <summary>Where every number came from (${rows.length})</summary>
      <ul>${rows.map((r) => `<li><b>${esc(r.what)}</b><span>${esc(r.basis)}</span></li>`).join('')}</ul>
      <p class="note">A figure somebody measured and a figure somebody guessed must not look
      alike on a screen that is about not confusing those two things.</p>
    </details>`;
}

function render(plan: Plan): void {
  const s = analyse(plan);
  const headline = s.refused
    ? `<div class="big refused">
         <span class="kicker">HOIST declines to schedule this plan</span>
         <p class="reason">${esc(s.refusalReason!)}</p>
       </div>`
    : `<div class="big">
         <span class="kicker">irreversibility bought for nothing</span>
         <p class="total">${hrs(s.totalExposure)}</p>
         <p class="reason">${
           s.tally.inverted + s.tally.absent === 0
             ? 'Every mandatory lookup in this plan already happened before the decision it could have changed.'
             : `${s.tally.inverted + s.tally.absent} ${
                 s.tally.inverted + s.tally.absent === 1 ? 'question was' : 'questions were'
               } cheaper than the decision that came first.`
         }</p>
       </div>`;

  outEl.innerHTML = `
    <section class="card verdict ${s.refused ? 'refused' : ''}">
      <div class="stephead"><span class="stepno">2</span><h2>What it cost</h2></div>
      ${headline}
    </section>

    <section class="card">
      <div class="stephead"><span class="stepno">3</span><h2>Every fact the plan committed to</h2></div>
      <ul class="exlist">${s.exposures.map(exposureRow).join('')}</ul>
      ${provenance(plan)}
    </section>

    <section class="card">
      <div class="stephead"><span class="stepno">4</span><h2>${
        s.refused ? 'The plan, as written' : 'Before and after'
      }</h2></div>
      <div class="tls">
        ${timeline(plan, s, plan.steps, s.refused ? 'As it happened' : 'As it happened', false)}
        ${
          s.steps
            ? timeline(plan, s, s.steps, 'Hoisted', true)
            : `<div class="tl refusedbox">
                 <h3>Hoisted</h3>
                 <p class="reason">No schedule. ${esc(s.refusalReason!)}</p>
                 <p class="note">Refusing is a return value here, not an error. The
                 alternative — emitting a plausible ordering built on a number nobody
                 checked — is the exact artifact that makes an unexamined decision feel
                 examined.</p>
               </div>`
        }
      </div>
    </section>`;
}

function mount(): void {
  plansEl.innerHTML = CORPUS.map(
    (p, i) => `<button type="button" class="pbtn${i === 0 ? ' on' : ''}" data-id="${p.id}">${esc(p.title)}</button>`,
  ).join('');
  for (const b of Array.from(plansEl.querySelectorAll<HTMLButtonElement>('.pbtn'))) {
    b.addEventListener('click', () => {
      for (const o of Array.from(plansEl.querySelectorAll('.pbtn'))) o.classList.toggle('on', o === b);
      const p = planById(b.dataset.id!);
      sourceEl.textContent = p.source;
      render(p);
      outEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  sourceEl.textContent = CORPUS[0].source;
  render(CORPUS[0]);
}

/** Same probe as the sibling project: the "no backend" claim, made checkable. */
(function probe(): void {
  const box = document.getElementById('probe');
  const txt = document.getElementById('probe-text');
  const dot = document.getElementById('pdot');
  if (!box || !txt || !dot) return;
  let n = 0;
  const paint = (): void => {
    txt.textContent = `network: ${navigator.onLine ? 'connected' : 'disconnected'} · ${n} request${n === 1 ? '' : 's'} since load`;
    box.classList.toggle('zero', n === 0);
    dot.classList.toggle('off', !navigator.onLine);
  };
  try {
    new PerformanceObserver((l) => { n += l.getEntries().length; paint(); }).observe({ type: 'resource', buffered: false });
  } catch { txt.textContent = 'this browser does not expose the network counter'; return; }
  addEventListener('online', paint);
  addEventListener('offline', paint);
  paint();
})();

mount();
