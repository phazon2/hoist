// src/plan.ts
function factById(plan, id) {
  return plan.facts.find((f) => f.id === id);
}
function stepIndex(plan, id) {
  return plan.steps.findIndex((s) => s.id === id);
}
function lookupIndex(plan, factId) {
  return plan.steps.findIndex((s) => s.looksUp === factId);
}
function commitmentIndex(plan, factId) {
  return plan.steps.findIndex((s) => s.commitsTo.includes(factId));
}

// src/hoist.ts
function earliestLegalPosition(plan, lookupStep, knowableFrom) {
  let floor = Math.max(0, knowableFrom);
  for (const req of lookupStep.requires) {
    const i = stepIndex(plan, req);
    if (i >= 0) floor = Math.max(floor, i + 1);
  }
  return floor;
}
function blockers(plan, lookupStep, target) {
  const out = [];
  for (const req of lookupStep.requires) {
    const i = stepIndex(plan, req);
    if (i >= target) out.push(req);
  }
  return out;
}
function analyse(plan) {
  const exposures = [];
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
      commitLabel: commitStep ? commitStep.label : "\u2014",
      lookupAt,
      lookupCost,
      reversalCost,
      exposure: null,
      liftBy: 0,
      blockedBy: []
    };
    if (commitAt < 0) {
      exposures.push({
        ...base,
        finding: "ordered",
        note: "No step in this plan commits to this fact, so nothing rides on when you learn it."
      });
      continue;
    }
    if (lookupCost === null || reversalCost === null) {
      exposures.push({
        ...base,
        finding: "undeclared",
        note: lookupCost === null && reversalCost === null ? "Neither the lookup cost nor the reversal cost was stated. HOIST will not guess either one." : lookupCost === null ? "The lookup cost was not stated. Assuming it is cheap is the exact error this tool exists to catch." : "The reversal cost of the committing step was not stated, so there is nothing to compare against."
      });
      continue;
    }
    if (fact.knowableFrom > commitAt) {
      exposures.push({
        ...base,
        finding: "unknowable",
        note: `This fact does not exist until step ${fact.knowableFrom + 1}, which is after the commitment at step ${commitAt + 1}. The ordering is not a mistake; the plan is structurally forced to commit while uninformed. That is worth knowing on its own.`
      });
      continue;
    }
    if (lookupCost >= reversalCost) {
      exposures.push({
        ...base,
        finding: "not_worth_it",
        note: `Looking this up costs ${lookupCost}h and being wrong costs ${reversalCost}h. The lookup is not mandatory. Skipping it is a defensible decision rather than an oversight \u2014 and stating that is the point.`
      });
      continue;
    }
    const exposure = reversalCost - lookupCost;
    if (lookupAt < 0) {
      exposures.push({
        ...base,
        finding: "absent",
        exposure,
        liftBy: commitAt,
        note: `Never looked up. The commitment at step ${commitAt + 1} costs ${reversalCost}h to reverse; learning this first costs ${lookupCost}h. ${exposure}h of irreversibility was bought for nothing.`
      });
      continue;
    }
    if (lookupAt < commitAt) {
      exposures.push({
        ...base,
        finding: "ordered",
        note: `Already looked up at step ${lookupAt + 1}, before the commitment at step ${commitAt + 1}. This is the shape you want.`
      });
      continue;
    }
    const lookupStep = plan.steps[lookupAt];
    const floor = earliestLegalPosition(plan, lookupStep, fact.knowableFrom);
    const blocked = blockers(plan, lookupStep, commitAt);
    exposures.push({
      ...base,
      finding: "inverted",
      exposure,
      liftBy: lookupAt - commitAt,
      blockedBy: blocked,
      note: `Looked up at step ${lookupAt + 1}, ${lookupAt - commitAt} steps AFTER the commitment at step ${commitAt + 1}. ${exposure}h of irreversibility was bought for a ${lookupCost}h question. ` + (blocked.length ? `It cannot be lifted above the commitment: ${blocked.join(", ")} must come first.` : `It can be lifted to position ${floor + 1} with no dependency broken.`)
    });
  }
  const tally = {
    ordered: 0,
    inverted: 0,
    absent: 0,
    not_worth_it: 0,
    unknowable: 0,
    undeclared: 0
  };
  for (const e of exposures) tally[e.finding]++;
  const totalExposure = exposures.reduce((a, e) => a + (e.exposure ?? 0), 0);
  if (tally.undeclared > 0) {
    return {
      steps: null,
      refused: true,
      refusalReason: `${tally.undeclared} ${tally.undeclared === 1 ? "fact has" : "facts have"} an undeclared cost. HOIST will not emit a reordered plan from a guess. A schedule you cannot check is worse than no schedule, because it looks like one.`,
      exposures,
      totalExposure,
      tally
    };
  }
  return {
    steps: reorder(plan, exposures),
    refused: false,
    refusalReason: null,
    exposures,
    totalExposure,
    tally
  };
}
function reorder(plan, exposures) {
  const moves = exposures.filter((e) => e.finding === "inverted" && e.blockedBy.length === 0 && e.lookupAt >= 0).sort((a, b) => a.commitAt - b.commitAt);
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

// src/corpus.ts
var CONTRAPARTE = {
  id: "contraparte",
  title: "Contract-review tool, 8-day hackathon",
  source: "Rep log 01 \u2014 Contraparte / AI Factory, 3\u201310 Aug 2026. Solo.",
  facts: [
    {
      id: "crowding",
      label: "In the reference event \u2014 same organiser, same judges, same rubric \u2014 contract review drew 15+ entries and produced zero winners.",
      lookupCost: 0.025,
      knowableFrom: 0,
      basis: 'measured \u2014 "Reading it cost one tool call... about ninety seconds"'
    },
    {
      id: "claims-true",
      label: "Do the factual claims in the submission match the shipped source?",
      lookupCost: 3,
      knowableFrom: 3,
      basis: "measured \u2014 the adversarial audit found four false claims in one night"
    },
    {
      id: "demo-is-deployed",
      label: "Does the build being filmed match the build that is actually deployed?",
      lookupCost: 0.25,
      knowableFrom: 0,
      basis: "estimated \u2014 one diff against the deployed source"
    }
  ],
  steps: [
    { id: "read-brief", label: "Read the hackathon brief", reversalCost: 0, commitsTo: [], requires: [] },
    {
      id: "choose",
      label: "Choose the category: contract review",
      reversalCost: 144,
      commitsTo: ["crowding"],
      requires: [],
      basis: "measured \u2014 the choice was six days old and load-bearing for every downstream artifact"
    },
    { id: "build", label: "Build the app", reversalCost: 40, commitsTo: [], requires: ["choose"] },
    {
      id: "write-claims",
      label: "Write the submission copy and README",
      reversalCost: 8,
      commitsTo: ["claims-true"],
      requires: ["build"],
      basis: "estimated \u2014 rewriting the submission, repo and deck"
    },
    {
      id: "film",
      label: "Film the demo video",
      reversalCost: 6,
      commitsTo: ["demo-is-deployed"],
      requires: ["build"],
      basis: "estimated \u2014 one full re-shoot and re-cut"
    },
    {
      id: "read-field-data",
      label: 'Open "Hackatons winners data" in Notion',
      reversalCost: 0,
      commitsTo: [],
      requires: [],
      looksUp: "crowding"
    },
    {
      id: "audit",
      label: "Adversarial audit of our own claims",
      reversalCost: 0,
      commitsTo: [],
      requires: ["write-claims"],
      looksUp: "claims-true"
    },
    { id: "submit", label: "Submit", reversalCost: 999, commitsTo: [], requires: ["film", "audit"] }
  ]
};
var RESCIND = {
  id: "rescind",
  title: "Agentic memory engine, 5-day hackathon",
  source: "Rep log 02 \u2014 Rescind / CockroachDB \xD7 AWS, 14\u201318 Aug 2026. Solo.",
  facts: [
    {
      id: "can-push",
      label: "Can this session actually push to the target repo with this token?",
      lookupCost: 0.05,
      knowableFrom: 0,
      basis: "estimated \u2014 one git push against the real remote"
    },
    {
      id: "cascade-ceiling",
      label: "At what closure size does the single-transaction retraction cascade stop committing?",
      lookupCost: 1.5,
      knowableFrom: 3,
      basis: "measured \u2014 the sweep that found the 127-fact ceiling"
    },
    {
      id: "operator-has-laptop",
      label: "Does the operator actually have a laptop available this week?",
      lookupCost: 0.02,
      knowableFrom: 0,
      basis: "estimated \u2014 one question"
    }
  ],
  steps: [
    { id: "probe-net", label: "Boundary probe: can we reach GitHub at all?", reversalCost: 0, commitsTo: [], requires: [] },
    {
      id: "pick-substrate",
      label: "Design GitHub Actions as the verification substrate",
      reversalCost: 12,
      commitsTo: ["can-push"],
      requires: [],
      basis: "estimated \u2014 706 lines written against a plan that could not run"
    },
    {
      id: "write-checklist",
      label: "Write the operator setup checklist",
      reversalCost: 1.5,
      commitsTo: ["operator-has-laptop"],
      requires: [],
      basis: "estimated \u2014 the checklist was rewritten for phone-only"
    },
    { id: "write-engine", label: "Write schema, engine, agent and tests", reversalCost: 20, commitsTo: [], requires: ["pick-substrate"] },
    {
      id: "try-push",
      label: "Attempt the actual push",
      reversalCost: 0,
      commitsTo: [],
      requires: [],
      looksUp: "can-push"
    },
    {
      id: "ask-laptop",
      label: "Ask the operator what hardware they have",
      reversalCost: 0,
      commitsTo: [],
      requires: [],
      looksUp: "operator-has-laptop"
    },
    {
      id: "bench",
      label: "Benchmark the cascade until it breaks",
      reversalCost: 0,
      commitsTo: [],
      requires: ["write-engine"],
      looksUp: "cascade-ceiling"
    },
    {
      id: "publish-limit",
      label: "Publish the ceiling in LIMITS.md",
      reversalCost: 2,
      commitsTo: ["cascade-ceiling"],
      requires: ["bench"],
      basis: "estimated \u2014 restating a limit across README, docs and pitch"
    }
  ]
};
var RUTA = {
  id: "ruta",
  title: "Exam-prep product, live with paying customers",
  source: "Rep log 03 \u2014 Ruta PAES / Build with Gemini XPRIZE, 9\u201317 Aug 2026.",
  facts: [
    {
      id: "tier",
      label: "Which billing tier is the deployed project actually on?",
      lookupCost: 0.01,
      knowableFrom: 0,
      basis: "measured \u2014 the tier label was printed in a screenshot already on screen"
    },
    {
      id: "funnel-works",
      label: "Does a real purchase actually deliver the product to the buyer?",
      lookupCost: 0.5,
      knowableFrom: 0,
      basis: "measured \u2014 one self-purchase at CLP 9.990"
    },
    {
      id: "one-prize-rule",
      label: "Do the prize mechanics allow one project to win more than one prize?",
      lookupCost: 0.05,
      knowableFrom: 0,
      basis: "measured \u2014 one page load of the rules"
    }
  ],
  steps: [
    {
      id: "advise-portfolio",
      label: "Recommend a single all-in project rather than a portfolio",
      reversalCost: 30,
      commitsTo: ["one-prize-rule"],
      requires: [],
      basis: "estimated \u2014 rebuilding the portfolio strategy late"
    },
    {
      id: "infer-tier",
      label: "Infer the billing tier from a throughput metric",
      reversalCost: 8,
      commitsTo: ["tier"],
      requires: [],
      basis: "estimated \u2014 the site was down for every visitor for an unknown period"
    },
    {
      id: "build-marketing",
      label: "Build and post the marketing assets",
      reversalCost: 10,
      commitsTo: ["funnel-works"],
      requires: [],
      basis: "estimated \u2014 traffic driven through a funnel that did not deliver"
    },
    { id: "read-rules", label: "Read the prize mechanics", reversalCost: 0, commitsTo: [], requires: [], looksUp: "one-prize-rule" },
    { id: "read-label", label: "Read the tier label in the console", reversalCost: 0, commitsTo: [], requires: [], looksUp: "tier" },
    { id: "buy-own", label: "Buy your own product end to end", reversalCost: 0, commitsTo: [], requires: [], looksUp: "funnel-works" }
  ]
};
var UNDECLARED = {
  id: "undeclared",
  title: "A plan with a cost nobody stated",
  source: "The ordinary case. Most plans look like this.",
  facts: [
    {
      id: "vendor-lockin",
      label: "Does this vendor let us export our data if we leave?",
      lookupCost: null,
      knowableFrom: 0,
      basis: 'never stated \u2014 "we can check that later"'
    },
    {
      id: "load",
      label: "What does the service do above 10k concurrent users?",
      lookupCost: 4,
      knowableFrom: 1,
      basis: "estimated \u2014 one load test"
    }
  ],
  steps: [
    {
      id: "sign",
      label: "Sign the annual vendor contract",
      reversalCost: 200,
      commitsTo: ["vendor-lockin"],
      requires: [],
      basis: "estimated \u2014 migration off the platform"
    },
    { id: "build", label: "Build on the vendor SDK", reversalCost: 80, commitsTo: [], requires: ["sign"] },
    {
      id: "launch",
      label: "Launch to the full user base",
      reversalCost: 24,
      commitsTo: ["load"],
      requires: ["build"],
      basis: "estimated \u2014 rollback and incident comms"
    },
    { id: "loadtest", label: "Run the load test", reversalCost: 0, commitsTo: [], requires: ["build"], looksUp: "load" }
  ]
};
var CORPUS = [CONTRAPARTE, RESCIND, RUTA, UNDECLARED];
function planById(id) {
  return CORPUS.find((p) => p.id === id) ?? CONTRAPARTE;
}

// web/main.ts
var $ = (s) => document.querySelector(s);
var plansEl = $("#plans");
var sourceEl = $("#source");
var outEl = $("#result");
var esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function hrs(h) {
  if (h === 0) return "0";
  if (h < 0.017) return `${Math.round(h * 3600)}s`;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h % 1 === 0 ? h : h.toFixed(2).replace(/\.?0+$/, "")} h`;
  const d = h / 24;
  return `${d % 1 === 0 ? d : d.toFixed(1)} days`;
}
var FINDING = {
  inverted: { label: "ACTED, THEN LOOKED", cls: "f-inv" },
  absent: { label: "NEVER LOOKED", cls: "f-abs" },
  ordered: { label: "LOOKED FIRST", cls: "f-ok" },
  not_worth_it: { label: "NOT WORTH IT", cls: "f-nwi" },
  unknowable: { label: "NOT KNOWABLE IN TIME", cls: "f-unk" },
  undeclared: { label: "COST NOT STATED", cls: "f-und" }
};
function timeline(plan, s, steps, title, lifted) {
  const invertedFacts = new Set(
    s.exposures.filter((e) => e.finding === "inverted" || e.finding === "absent").map((e) => e.factId)
  );
  const wasMoved = /* @__PURE__ */ new Set();
  if (lifted) {
    const before = new Map(plan.steps.map((st, i) => [st.id, i]));
    steps.forEach((st, i) => {
      const b = before.get(st.id);
      if (b !== void 0 && i < b) wasMoved.add(st.id);
    });
  }
  return `
    <div class="tl">
      <h3>${esc(title)}</h3>
      <ol class="steps">
        ${steps.map((st, i) => {
    const isLookup = !!st.looksUp;
    const hot = isLookup ? invertedFacts.has(st.looksUp) : st.commitsTo.some((c) => invertedFacts.has(c));
    const cls = [
      isLookup ? "lookup" : "",
      st.commitsTo.length ? "commits" : "",
      hot ? "hot" : "",
      wasMoved.has(st.id) ? "moved" : ""
    ].filter(Boolean).join(" ");
    return `<li class="${cls}">
              <span class="i">${i + 1}</span>
              <span class="lbl">${esc(st.label)}</span>
              <span class="tags">
                ${isLookup ? '<em class="t-look">lookup</em>' : ""}
                ${st.commitsTo.length ? `<em class="t-commit">commits &middot; ${st.reversalCost === null ? "cost not stated" : hrs(st.reversalCost) + " to undo"}</em>` : ""}
                ${isLookup && lifted && !wasMoved.has(st.id) && hot ? '<em class="t-block">could not be lifted</em>' : ""}
              </span>
            </li>`;
  }).join("")}
      </ol>
    </div>`;
}
function exposureRow(e) {
  const f = FINDING[e.finding];
  return `
    <li class="ex ${f.cls}">
      <div class="exhead">
        <span class="badge ${f.cls}">${f.label}</span>
        ${e.exposure !== null ? `<span class="expo">${hrs(e.exposure)}</span>` : ""}
      </div>
      <p class="q">${esc(e.factLabel)}</p>
      <div class="nums">
        <span><b>lookup</b> ${e.lookupCost === null ? "\u2014" : hrs(e.lookupCost)}</span>
        <span><b>undo</b> ${e.reversalCost === null ? "\u2014" : hrs(e.reversalCost)}</span>
        <span><b>committed at</b> ${e.commitAt < 0 ? "\u2014" : "step " + (e.commitAt + 1)}</span>
        <span><b>looked up at</b> ${e.lookupAt < 0 ? "never" : "step " + (e.lookupAt + 1)}</span>
      </div>
      <p class="note">${esc(e.note)}</p>
    </li>`;
}
function provenance(plan) {
  const rows = [
    ...plan.facts.filter((f) => f.basis).map((f) => ({ what: `lookup: ${f.label}`, basis: f.basis })),
    ...plan.steps.filter((s) => s.basis).map((s) => ({ what: `undo: ${s.label}`, basis: s.basis }))
  ];
  if (!rows.length) return "";
  return `
    <details class="prov">
      <summary>Where every number came from (${rows.length})</summary>
      <ul>${rows.map((r) => `<li><b>${esc(r.what)}</b><span>${esc(r.basis)}</span></li>`).join("")}</ul>
      <p class="note">A figure somebody measured and a figure somebody guessed must not look
      alike on a screen that is about not confusing those two things.</p>
    </details>`;
}
function render(plan) {
  const s = analyse(plan);
  const headline = s.refused ? `<div class="big refused">
         <span class="kicker">HOIST declines to schedule this plan</span>
         <p class="reason">${esc(s.refusalReason)}</p>
       </div>` : `<div class="big">
         <span class="kicker">irreversibility bought for nothing</span>
         <p class="total">${hrs(s.totalExposure)}</p>
         <p class="reason">${s.tally.inverted + s.tally.absent === 0 ? "Every mandatory lookup in this plan already happened before the decision it could have changed." : `${s.tally.inverted + s.tally.absent} ${s.tally.inverted + s.tally.absent === 1 ? "question was" : "questions were"} cheaper than the decision that came first.`}</p>
       </div>`;
  outEl.innerHTML = `
    <section class="card verdict ${s.refused ? "refused" : ""}">
      <div class="stephead"><span class="stepno">2</span><h2>What it cost</h2></div>
      ${headline}
    </section>

    <section class="card">
      <div class="stephead"><span class="stepno">3</span><h2>Every fact the plan committed to</h2></div>
      <ul class="exlist">${s.exposures.map(exposureRow).join("")}</ul>
      ${provenance(plan)}
    </section>

    <section class="card">
      <div class="stephead"><span class="stepno">4</span><h2>${s.refused ? "The plan, as written" : "Before and after"}</h2></div>
      <div class="tls">
        ${timeline(plan, s, plan.steps, s.refused ? "As it happened" : "As it happened", false)}
        ${s.steps ? timeline(plan, s, s.steps, "Hoisted", true) : `<div class="tl refusedbox">
                 <h3>Hoisted</h3>
                 <p class="reason">No schedule. ${esc(s.refusalReason)}</p>
                 <p class="note">Refusing is a return value here, not an error. The
                 alternative \u2014 emitting a plausible ordering built on a number nobody
                 checked \u2014 is the exact artifact that makes an unexamined decision feel
                 examined.</p>
               </div>`}
      </div>
    </section>`;
}
function mount() {
  plansEl.innerHTML = CORPUS.map(
    (p, i) => `<button type="button" class="pbtn${i === 0 ? " on" : ""}" data-id="${p.id}">${esc(p.title)}</button>`
  ).join("");
  for (const b of Array.from(plansEl.querySelectorAll(".pbtn"))) {
    b.addEventListener("click", () => {
      for (const o of Array.from(plansEl.querySelectorAll(".pbtn"))) o.classList.toggle("on", o === b);
      const p = planById(b.dataset.id);
      sourceEl.textContent = p.source;
      render(p);
      outEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  sourceEl.textContent = CORPUS[0].source;
  render(CORPUS[0]);
}
(function probe() {
  const box = document.getElementById("probe");
  const txt = document.getElementById("probe-text");
  const dot = document.getElementById("pdot");
  if (!box || !txt || !dot) return;
  let n = 0;
  const paint = () => {
    txt.textContent = `network: ${navigator.onLine ? "connected" : "disconnected"} \xB7 ${n} request${n === 1 ? "" : "s"} since load`;
    box.classList.toggle("zero", n === 0);
    dot.classList.toggle("off", !navigator.onLine);
  };
  try {
    new PerformanceObserver((l) => {
      n += l.getEntries().length;
      paint();
    }).observe({ type: "resource", buffered: false });
  } catch {
    txt.textContent = "this browser does not expose the network counter";
    return;
  }
  addEventListener("online", paint);
  addEventListener("offline", paint);
  paint();
})();
mount();
