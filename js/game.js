// Would you rather tab. Each round has a scenario (population size N and
// prior, so the row totals P and Q are known), a goal, and two
// classifiers each described by two clues in different terms. One clue is
// always about a row (TPR, FNR, FN, TNR, FPR or FP), so it fills one cell;
// the other fills a second; together they give the whole matrix. After a
// pick, the reveal shows both matrices and that derivation. Under "Just
// the popular ones" the clues are TPR, FPR, precision, accuracy and counts.

const SCENARIOS = [
  { title: "Strep throat", N: 1000, prev: [0.25, 0.4],
    pop: "children with a sore throat", pos: "children with strep",
    neg: "children without strep",
    cost: { miss: 5, fa: 1, text: "Missing strep (no antibiotics, risk of "
      + "complications) is 5× as bad as a false alarm (an unneeded course "
      + "of antibiotics)." } },
  { title: "Spam filter", N: 1000, prev: [0.3, 0.6], pop: "emails",
    pos: "spam emails", neg: "real emails",
    cost: { miss: 1, fa: 10, text: "A real email lost in the spam folder "
      + "is 10× as bad as a spam email reaching the inbox." } },
  { title: "Card fraud", N: 10000, prev: [0.01, 0.03],
    pop: "card transactions", pos: "fraudulent transactions",
    neg: "legitimate transactions",
    cost: { miss: 20, fa: 1, text: "A missed fraud costs 20× as much as a "
      + "false alarm (a declined card and a phone call)." } },
  { title: "Bot accounts", N: 1000, prev: [0.08, 0.2],
    pop: "social media accounts", pos: "bots", neg: "human accounts",
    cost: { miss: 1, fa: 4, text: "Banning a human is 4× as bad as "
      + "letting a bot through." } },
  { title: "Defective screens", N: 10000, prev: [0.02, 0.06],
    pop: "phone screens off the line", pos: "defective screens",
    neg: "good screens",
    cost: { miss: 15, fa: 1, text: "Shipping a defective screen costs 15× "
      + "as much as re-inspecting a good one." } },
];

// Each goal's loss (lower is better) and its value as shown.
const GOALS = {
  acc: { text: () => "Pick the one that makes fewer mistakes overall "
      + "(higher accuracy).",
    loss: c => c.fp + c.fn,
    show: c => `accuracy = ${pct(metricValue("acc", c))} `
      + `(${num(c.fp + c.fn)} mistakes)` },
  cost: { text: s => `${s.cost.text} Pick the one with the lower total `
      + "cost.",
    loss: (c, s) => s.cost.miss * c.fn + s.cost.fa * c.fp,
    show: (c, s) => `cost = ${s.cost.miss} × FN + ${s.cost.fa} × FP = `
      + `${s.cost.miss} × ${num(c.fn)} + ${s.cost.fa} × ${num(c.fp)} = `
      + `${num(s.cost.miss * c.fn + s.cost.fa * c.fp)}` },
  ppv: { text: s => `When it flags something, it should really be one of `
      + `the ${s.pos} (higher precision).`,
    loss: c => 1 - metricValue("ppv", c),
    show: c => `precision = ${pct(metricValue("ppv", c))}` },
  tpr: { text: s => `Catch as many of the ${s.pos} as possible (higher `
      + "recall).",
    loss: c => c.fn,
    show: c => `recall = ${pct(metricValue("tpr", c))} `
      + `(${num(c.tp)} caught)` },
  fpr: { text: s => `Bother as few of the ${s.neg} as possible (fewer false `
      + "alarms).",
    loss: c => c.fp,
    show: c => `FPR = ${pct(metricValue("fpr", c))} `
      + `(${num(c.fp)} false alarms)` },
};

// Clues: fam groups clues that fix the same quantity (R: the Truth 1 row
// split, F: the Truth 0 row split, PP / NP: the predicted columns, A:
// accuracy, Q: number flagged).
const CLUES = {
  tpr: { fam: "R", name: "Recall (TPR, sensitivity)", rate: "tpr" },
  fnr: { fam: "R", name: "Miss rate (FNR)", rate: "fnr" },
  fn: { fam: "R", name: "False negatives (FN)", count: "fn" },
  tnr: { fam: "F", name: "Specificity (TNR)", rate: "tnr" },
  fpr: { fam: "F", name: "False alarm rate (FPR)", rate: "fpr" },
  fp: { fam: "F", name: "False positives (FP)", count: "fp" },
  ppv: { fam: "PP", name: "Precision (PPV)", rate: "ppv" },
  fdr: { fam: "PP", name: "False discovery rate (FDR)", rate: "fdr" },
  npv: { fam: "NP", name: "NPV", rate: "npv" },
  acc: { fam: "A", name: "Accuracy", rate: "acc" },
  flag: { fam: "Q", name: "Flagged (TP + FP)", count: "flag" },
};
const POPULAR_CLUES = ["tpr", "fn", "fpr", "fp", "ppv", "acc", "flag"];

// Clues that would hand over the goal directly.
const EXCLUDE = { acc: ["acc"], ppv: ["ppv", "fdr"],
  tpr: ["tpr", "fnr", "fn"], fpr: ["fpr", "tnr", "fp"], cost: [] };

// show: draw each option's confusion matrix and mosaic before the pick;
// hl: the clue under the pointer { i, type }, lit up in that option's data.
const G = { round: null, right: 0, played: 0, streak: 0, show: false,
  hl: null };

function gNouns() {
  const s = G.round.s;
  return { pop: s.pop, pos: s.pos, neg: s.neg };
}
EXPLAIN.game0 = () => ({ c: G.round.opts[0].c, n: gNouns(),
  who: "classifier A" });
EXPLAIN.game1 = () => ({ c: G.round.opts[1].c, n: gNouns(),
  who: "classifier B" });
EXPLAIN.cheat = () => ({ n: gNouns(), who: "the classifier" });

/** Cells a clue reads: a metric's fraction, or the counted cells. */
function clueHL(type) {
  const k = CLUES[type];
  if (k.count === "flag") return { num: ["fp", "tp"], den: [] };
  if (k.count) return { num: [k.count], den: [] };
  return highlightOf(k.rate);
}

/** Key the hover sentence explains for a clue. */
function clueKey(type) {
  const k = CLUES[type];
  return k.rate || k.count;
}
const gEls = {};
const gr = rng(Date.now() % 1e9);

function pick(a) { return a[Math.floor(gr() * a.length)]; }

/** A clue's value as shown, rounded as the student sees it. */
function clueValue(type, c) {
  const k = CLUES[type];
  if (k.count === "flag") return c.tp + c.fp;
  if (k.count) return c[k.count];
  const v = metricValue(k.rate, c);
  return Math.round(v * 1000) / 1000;
}

function clueText(type, c) {
  const v = clueValue(type, c);
  return CLUES[type].count ? num(v) : pct(v);
}

function pickClues(goal, avoid) {
  const ok = Object.keys(CLUES).filter(t => !EXCLUDE[goal].includes(t)
    && !avoid.includes(t)
    && (!SETTINGS.popular || POPULAR_CLUES.includes(t)));
  const row = ok.filter(t => ["R", "F"].includes(CLUES[t].fam));
  if (!row.length) return null;
  const a = pick(row);
  const rest = ok.filter(t => CLUES[t].fam !== CLUES[a].fam);
  // Favor a column, accuracy or flag clue as the second.
  const off = rest.filter(t => !["R", "F"].includes(CLUES[t].fam));
  const b = off.length && gr() < 0.75 ? pick(off) : pick(rest);
  return [a, b];
}

function makeClassifier(P, Q) {
  const tpr = 0.45 + 0.54 * gr();
  const fpr = Math.exp(Math.log(0.004) + gr() * Math.log(0.4 / 0.004));
  const tp = Math.round(tpr * P), fp = Math.round(fpr * Q);
  return { tn: Q - fp, fp, fn: P - tp, tp };
}

/**
 * Draw a round by rejection: the goal must separate the two by a clear
 * margin (losses 20% apart), and the loser must still beat the winner on
 * one familiar metric, so neither option is better on everything.
 */
function makeRound() {
  for (let tries = 0; tries < 2000; tries++) {
    const s = pick(SCENARIOS);
    const prev = s.prev[0] + gr() * (s.prev[1] - s.prev[0]);
    const P = Math.round(prev * s.N), Q = s.N - P;
    const goal = pick(Object.keys(GOALS));
    const cs = [makeClassifier(P, Q), makeClassifier(P, Q)];
    if (cs.some(c => CELLS.some(k => c[k] < 1))) continue;
    const loss = cs.map(c => GOALS[goal].loss(c, s));
    const hi = Math.max(...loss), lo = Math.min(...loss);
    if (!(hi > 0) || (hi - lo) / hi < 0.2) continue;
    const win = loss[0] < loss[1] ? 0 : 1;
    const mw = allMetrics(cs[win]), ml = allMetrics(cs[1 - win]);
    if (!["acc", "tpr", "ppv", "tnr"].some(k => ml[k] > mw[k] + 0.01)) {
      continue;
    }
    const a = pickClues(goal, []);
    const b = a && pickClues(goal, a);
    if (!b) continue;
    const rd = { s, P, Q, N: s.N, goal, win, picked: null,
      opts: [{ c: cs[0], clues: a }, { c: cs[1], clues: b }] };
    // The clues as shown must settle the goal: every matrix they allow
    // for the winner beats every one they allow for the loser.
    const ls = rd.opts.map(o => consistent(o, rd)
      .map(c => GOALS[goal].loss(c, s)));
    if (ls.some(l => !l.length)) continue;
    if (Math.max(...ls[win]) < Math.min(...ls[1 - win])) return rd;
  }
  throw new Error("no round found");
}

/**
 * Every matrix whose clues read the same as option o's, to the rounding
 * shown. The row clue (first) involves one row only, so it is checked
 * alone before the second clue scans the other row.
 */
function consistent(o, rd) {
  const { P, Q } = rd, [r, x] = o.clues, out = [];
  const shown = o.clues.map(t => clueText(t, o.c));
  const truth1 = CLUES[r].fam === "R";
  for (let a = 0; a <= (truth1 ? P : Q); a++) {
    const c = { ...o.c };
    if (truth1) Object.assign(c, { tp: a, fn: P - a });
    else Object.assign(c, { fp: a, tn: Q - a });
    if (clueText(r, c) !== shown[0]) continue;
    for (let b = 0; b <= (truth1 ? Q : P); b++) {
      if (truth1) Object.assign(c, { fp: b, tn: Q - b });
      else Object.assign(c, { tp: b, fn: P - b });
      if (clueText(x, c) === shown[1]) out.push({ ...c });
    }
  }
  return out;
}

// ------------------------------------------------------------ derivation

/**
 * Steps from the clues to the counts, as HTML lines. The row clue fixes
 * TP and FN (or FP and TN); the second clue then fixes the other row.
 */
function deriveHTML(o, rd) {
  const { P, Q, N } = rd, c = o.c, n = num;
  const [r, x] = o.clues;
  const L = [rowLine(r, c, rd)];
  const truth1 = CLUES[r].fam === "R";
  // The other row, from the second clue.
  const rest1 = `TP = ${n(c.tp)}, FN = ${n(P)} − ${n(c.tp)} = ${n(c.fn)}.`;
  const rest0 = `TN = ${n(Q)} − ${n(c.fp)} = ${n(c.tn)}.`;
  const xv = clueValue(x, c), X = clueText(x, c);
  if (CLUES[x].fam === "R" || CLUES[x].fam === "F") {
    L.push(rowLine(x, c, rd));
  } else if (truth1) {
    const f = {
      ppv: () => `Precision ${X}: TP + FP = ${n(c.tp)} / ${X} ≈ `
        + `${n(c.tp + c.fp)}, so FP ≈ ${n(c.fp)} and ${rest0}`,
      fdr: () => `FDR ${X}: precision = 1 − ${X}, TP + FP = ${n(c.tp)} / `
        + `${pct(1 - xv)} ≈ ${n(c.tp + c.fp)}, so FP ≈ ${n(c.fp)} and `
        + rest0,
      npv: () => `NPV ${X} = TN / (TN + FN): TN = ${X} × ${n(c.fn)} / `
        + `${pct(1 - xv)} ≈ ${n(c.tn)}, so FP = ${n(Q)} − ${n(c.tn)} = `
        + `${n(c.fp)}.`,
      acc: () => `Accuracy ${X}: TP + TN = ${X} × ${n(N)} ≈ `
        + `${n(c.tp + c.tn)}, so TN ≈ ${n(c.tn)} and FP = ${n(c.fp)}.`,
      flag: () => `TP + FP = ${X}, so FP = ${X} − ${n(c.tp)} = ${n(c.fp)} `
        + `and ${rest0}`,
    };
    L.push(f[x]());
  } else {
    const f = {
      ppv: () => `Precision ${X} = TP / (TP + FP): TP = ${X} × ${n(c.fp)} / `
        + `${pct(1 - xv)} ≈ ${n(c.tp)}, so FN = ${n(c.fn)}.`,
      fdr: () => `FDR ${X} = FP / (TP + FP): TP + FP = ${n(c.fp)} / ${X} ≈ `
        + `${n(c.tp + c.fp)}, so ${rest1}`,
      npv: () => `NPV ${X} = TN / (TN + FN): TN + FN = ${n(c.tn)} / ${X} ≈ `
        + `${n(c.tn + c.fn)}, so FN ≈ ${n(c.fn)} and TP = ${n(c.tp)}.`,
      acc: () => `Accuracy ${X}: TP + TN = ${X} × ${n(N)} ≈ `
        + `${n(c.tp + c.tn)}, so ${rest1}`,
      flag: () => `TP + FP = ${X}, so ${rest1}`,
    };
    L.push(f[x]());
  }
  return L;
}

/** The cell pair a row clue fixes, from the row total. */
function rowLine(t, c, rd) {
  const { P, Q } = rd, n = num, V = clueText(t, c);
  if (t === "tpr") {
    return `TPR ${V}: TP = ${V} × ${n(P)} ≈ ${n(c.tp)}, so FN = `
      + `${n(P)} − ${n(c.tp)} = ${n(c.fn)}.`;
  }
  if (t === "fnr") {
    return `FNR ${V}: FN = ${V} × ${n(P)} ≈ ${n(c.fn)}, so TP = `
      + `${n(P)} − ${n(c.fn)} = ${n(c.tp)}.`;
  }
  if (t === "fn") {
    return `FN = ${n(c.fn)}, so TP = ${n(P)} − ${n(c.fn)} = ${n(c.tp)}.`;
  }
  if (t === "tnr") {
    return `TNR ${V}: TN = ${V} × ${n(Q)} ≈ ${n(c.tn)}, so FP = `
      + `${n(Q)} − ${n(c.tn)} = ${n(c.fp)}.`;
  }
  if (t === "fpr") {
    return `FPR ${V}: FP = ${V} × ${n(Q)} ≈ ${n(c.fp)}, so TN = `
      + `${n(Q)} − ${n(c.fp)} = ${n(c.tn)}.`;
  }
  return `FP = ${n(c.fp)}, so TN = ${n(Q)} − ${n(c.fp)} = ${n(c.tn)}.`;
}

// ----------------------------------------------------------------- build

function gBuild() {
  for (const id of ["g-scene", "g-opts", "g-verdict", "g-score",
    "g-next", "g-show", "g-cheat"]) {
    gEls[id] = document.getElementById(id);
  }
  gEls["g-next"].onclick = newRound;
  gEls["g-show"].onchange = () => {
    G.show = gEls["g-show"].checked;
    gDraw();
  };
  gCheat();
  newRound();
}

function gCheat() {
  gEls["g-cheat"].innerHTML = shownMetrics().map(m => `<div class="mrow
    cheat" data-explain="${m.key}"><span class="mname">${m.name}${m.aka
      ? `<span class="aka">${m.aka}</span>` : ""}</span>
    <span class="mdef">${defHTML(m.key)}</span></div>`).join("");
}

function newRound() {
  G.round = makeRound();
  G.hl = null;
  gDraw();
}

function choose(i) {
  const rd = G.round;
  if (rd.picked !== null) return;
  rd.picked = i;
  G.played++;
  if (i === rd.win) {
    G.right++;
    G.streak++;
  } else {
    G.streak = 0;
  }
  gDraw();
}

function gDraw() {
  const rd = G.round, s = rd.s, done = rd.picked !== null;
  gEls["g-scene"].innerHTML = `
    <h2>${s.title}</h2>
    <p>${num(rd.N)} ${s.pop}: <b>${num(rd.P)}</b> are ${s.pos} and
      <b>${num(rd.Q)}</b> are ${s.neg} (prior ${pct(rd.P / rd.N)}).</p>
    <p class="goal"><b>Goal:</b> ${GOALS[rd.goal].text(s)}</p>
    <p class="wyr">Would you rather use&hellip;</p>`;
  gEls["g-opts"].replaceChildren(...rd.opts.map((o, i) => optionCard(o, i)));
  let verdict = "";
  if (done) {
    const ok = rd.picked === rd.win, w = "AB"[rd.win];
    verdict = `<p class="${ok ? "yes" : "no"}">${ok ? "Right!" : "Not this "
      + "time."} Classifier ${w} wins: ${GOALS[rd.goal].show(
      rd.opts[rd.win].c, s)}, against ${GOALS[rd.goal].show(
      rd.opts[1 - rd.win].c, s)}.</p>`;
  }
  gEls["g-verdict"].innerHTML = verdict;
  gEls["g-score"].innerHTML = `
    <div class="row"><span>Right</span><span class="val">${G.right} of
      ${G.played}</span></div>
    <div class="row"><span>Streak</span><span class="val">${G.streak}
      </span></div>`;
}

function optionCard(o, i) {
  const rd = G.round, s = rd.s, done = rd.picked !== null;
  const card = document.createElement("div");
  card.className = "option card" + (done ? (i === rd.win ? " win" : " lose")
    : "") + (rd.picked === i ? " picked" : "");
  card.dataset.ctx = `game${i}`;
  card.innerHTML = `<h3>Classifier ${"AB"[i]}</h3>` + o.clues.map(t => `
    <div class="clue" data-type="${t}" data-explain="${clueKey(t)}">
      <span class="cname">${CLUES[t].name}</span>
      <span class="cval">${clueText(t, o.c)}</span></div>`).join("");
  const data = document.createElement("div");
  data.className = "opt-data";
  card.append(data);
  drawOptData(data, o, i);
  for (const el of card.querySelectorAll(".clue")) {
    el.onmouseenter = () => {
      G.hl = { i, type: el.dataset.type };
      drawOptData(data, o, i);
    };
    el.onmouseleave = () => {
      G.hl = null;
      drawOptData(data, o, i);
    };
  }
  if (!done) {
    const b = document.createElement("button");
    b.className = "choose";
    b.textContent = `Choose ${"AB"[i]}`;
    b.onclick = () => choose(i);
    card.append(b);
    return card;
  }
  const rev = document.createElement("div");
  rev.className = "reveal";
  rev.innerHTML = `<ol class="derive">${deriveHTML(o, rd)
    .map(l => `<li>${l}</li>`).join("")}</ol>
    <p class="goalval">${GOALS[rd.goal].show(o.c, s)}</p>`;
  card.append(rev);
  return card;
}

/**
 * The option's confusion matrix and mosaic, shown once picked or while
 * Show the data is on; the hovered clue's cells are highlighted.
 */
function drawOptData(el, o, i) {
  const rd = G.round;
  el.replaceChildren();
  if (rd.picked === null && !G.show) return;
  const hl = G.hl && G.hl.i === i ? clueHL(G.hl.type) : null;
  const svg = node("svg", { viewBox: "0 0 220 150", class: "mini-mosaic" },
    el);
  drawMosaic(svg, o.c, { x0: 4, x1: 216, y0: 4, y1: 146 },
    { toScale: false, labels: true, hl });
  const td = k => `<td class="cm-cell ${k} ${cellState(k, hl)}"
    data-cell="${k}">${chip(k)} ${num(o.c[k])}</td>`;
  el.insertAdjacentHTML("beforeend", `<table class="cm mini"><thead><tr>
    <th></th><th>Predict 0</th><th>Predict 1</th></tr></thead><tbody>
    <tr><th>Truth 0</th>${td("tn")}${td("fp")}</tr>
    <tr><th>Truth 1</th>${td("fn")}${td("tp")}</tr></tbody></table>`);
}

function gKey(e) {
  const rd = G.round;
  if (rd.picked === null && (e.key === "a" || e.key === "b")) {
    choose(e.key === "a" ? 0 : 1);
  } else if (rd.picked !== null && (e.key === "Enter" || e.key === "n")) {
    newRound();
  } else {
    return false;
  }
  return true;
}
