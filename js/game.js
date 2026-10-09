// Test yourself tab: three kinds of round, picked at the top of the
// panel. Which number? matches stakeholder questions to the metrics that
// answer them, by drawing lines. New prior keeps a test's TPR and FPR,
// moves it to a population with another prior, and asks which numbers go
// up, stay or go down. Would you rather? gives two classifiers by TPR and
// FPR only, kept when the prior decides which makes fewer mistakes. The
// score counts every answer, across kinds.

// Nouns fill the question bank: pop is everyone ("everyone", "all emails"),
// one / many a sample and samples; has1 / has0 (has1s singular) say a sample
// is in a class, a1 / a0 name one sample, pp / pn the samples predicted 1
// / 0, says1 / says0 the test's call on one sample, to1 / to0 what then
// happens to it, just1 / just0 a stakeholder's news about one sample and
// it1 what they fear. prev is the prior range for Would you rather?, wide the
// wider one for New prior.
const SCENARIOS = [
  { title: "Strep throat", prev: [0.25, 0.4], wide: [0.05, 0.5],
    pop: "everyone", one: "child", many: "children",
    pos: "children with strep",
    neg: "children without strep", has1: "have strep",
    has0: "don't have strep", has1s: "has strep", condIs: "is strep",
    test: "the rapid test", pp: "children who test positive",
    pn: "children who test negative", says1: "says positive",
    says0: "says negative", a1: "a child with strep",
    a0: "a child without strep", to1: "test positive", to0: "test negative",
    just1: "My daughter just tested positive",
    just0: "My daughter just tested negative", it1: "she has strep",
    place: "clinic" },
  { title: "Spam filter", prev: [0.3, 0.6], wide: [0.1, 0.8],
    pop: "all emails", one: "email", many: "emails", pos: "spam emails",
    neg: "real emails", has1: "are spam",
    has0: "are not spam", has1s: "is spam", condIs: "is spam",
    test: "the spam filter", pp: "emails in the spam folder",
    pn: "emails in the inbox", says1: "sends an email to spam",
    says0: "lets an email into the inbox", a1: "a spam email",
    a0: "a real email", to1: "land in the spam folder", to0: "reach the inbox",
    just1: "An email just landed in my spam folder",
    just0: "An email just reached my inbox", it1: "it is spam",
    place: "company" },
  { title: "Card fraud", prev: [0.01, 0.03], wide: [0.002, 0.05],
    pop: "all card transactions", one: "transaction",
    many: "card transactions", pos: "fraudulent transactions",
    neg: "legitimate transactions", has1: "are fraud",
    has0: "are legitimate", has1s: "is fraud", condIs: "is fraud",
    test: "the fraud model", pp: "blocked transactions",
    pn: "transactions that go through", says1: "blocks a transaction",
    says0: "lets a transaction through", a1: "a fraudulent transaction",
    a0: "a legitimate transaction", to1: "get blocked", to0: "go through",
    just1: "A transaction just got blocked",
    just0: "A transaction just went through", it1: "it is fraud",
    place: "bank" },
  { title: "Bot accounts", prev: [0.08, 0.2], wide: [0.02, 0.4],
    pop: "all accounts", one: "account", many: "social media accounts",
    pos: "bots", neg: "human accounts",
    has1: "are bots", has0: "are human", has1s: "is a bot",
    condIs: "are bots", test: "the bot detector", pp: "flagged accounts",
    pn: "cleared accounts", says1: "flags an account",
    says0: "clears an account", a1: "a bot", a0: "a human account",
    to1: "get flagged", to0: "get cleared",
    just1: "An account just got flagged",
    just0: "An account just got cleared", it1: "it is a bot",
    place: "platform" },
  { title: "Defective screens", prev: [0.02, 0.06], wide: [0.005, 0.1],
    pop: "all screens", one: "screen", many: "screens",
    pos: "defective screens",
    neg: "good screens", has1: "are defective", has0: "are good",
    has1s: "is defective", condIs: "are defects",
    test: "the inspection camera", pp: "rejected screens",
    pn: "screens that pass", says1: "rejects a screen",
    says0: "passes a screen", a1: "a defective screen", a0: "a good screen",
    to1: "get rejected", to0: "pass inspection",
    just1: "A screen just got rejected", just0: "A screen just passed",
    it1: "it is defective", place: "factory" },
];

// Questions a stakeholder might ask, by the metric that answers them.
// They say what is counted out of what, never the metric's name.
const ASK = {
  prev: [
    n => `Forget ${n.test}: what share of ${n.pop} ${n.has1}?`,
    n => `Before ${n.test} runs, how common ${n.condIs} among ${n.pop}?`,
    n => `With no test at all, what is the chance that a random ${n.one} `
      + `${n.has1s}?`,
  ],
  acc: [
    n => `Counting ${n.pop}, what share does ${n.test} get right?`,
    n => `How often is ${n.test} right, whichever way the truth goes?`,
    n => `Taking ${n.pop} together, how often does the call from `
      + `${n.test} match the truth?`,
  ],
  tpr: [
    n => `Of all the ${n.pos}, what share does ${n.test} catch?`,
    n => `How likely is ${n.a1} to ${n.to1}?`,
    n => `Among the ${n.pos}, how often is ${n.test} right?`,
  ],
  fnr: [
    n => `Of all the ${n.pos}, what share slips past ${n.test}?`,
    n => `How likely is ${n.a1} to ${n.to0}?`,
    n => `Among the ${n.pos}, how often is ${n.test} wrong?`,
  ],
  tnr: [
    n => `Of all the ${n.neg}, what share does ${n.test} correctly clear?`,
    n => `How likely is ${n.a0} to ${n.to0}?`,
    n => `Among the ${n.neg}, how often is ${n.test} right?`,
  ],
  fpr: [
    n => `Of all the ${n.neg}, what share does ${n.test} wrongly flag?`,
    n => `How likely is ${n.a0} to ${n.to1}?`,
    n => `Among the ${n.neg}, how often is ${n.test} wrong?`,
  ],
  ppv: [
    n => `Of the ${n.pp}, what share really ${n.has1}?`,
    n => `When ${n.test} ${n.says1}, how often is it right?`,
    n => `${n.just1}. How likely is it that ${n.it1}?`,
  ],
  fdr: [
    n => `Of the ${n.pp}, what share ${n.has0} after all?`,
    n => `When ${n.test} ${n.says1}, how often is it wrong?`,
    n => `Of everything ${n.test} flags, what share is wasted on `
      + `${n.neg}?`,
  ],
  npv: [
    n => `Of the ${n.pn}, what share really ${n.has0}?`,
    n => `When ${n.test} ${n.says0}, how often is it right?`,
  ],
  for: [
    n => `Of the ${n.pn}, what share ${n.has1} after all?`,
    n => `When ${n.test} ${n.says0}, how often is it wrong?`,
    n => `${n.just0}. How likely is it that ${n.it1} anyway?`,
  ],
  bacc: [
    n => `If the ${n.pos} and the ${n.neg} counted equally, however many of `
      + `each there are, how often would ${n.test} be right?`,
    n => `Averaging how well ${n.test} does on the ${n.pos} and on the `
      + `${n.neg}, what do we get?`,
  ],
};

const KINDS = ["match", "shift", "wyr"];

// FPRs a classifier may have, as shown.
const FPRS = [0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12,
  0.15, 0.2, 0.25, 0.3];

// The metrics New prior asks about, and the answers it offers.
const SHIFT_KEYS = ["tpr", "fpr", "ppv", "acc"];
const MOVES = ["up", "same", "down"];

// rounds: the current round of each kind; built: the Which number? round
// whose DOM is on screen; drag: the line being drawn; eat: a drag just
// ended, so the click that follows it is not a click.
const G = { kind: "match", rounds: {}, right: 0, played: 0, streak: 0,
  built: null, drag: null, eat: false };

const gEls = {};
const gr = rng(Date.now() % 1e9);

function pick(a) { return a[Math.floor(gr() * a.length)]; }

/** Copy of a in random order (Fisher-Yates). */
function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(gr() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Percentage, with one decimal only when it is not whole. */
function pctR(v) {
  return pct(v, Math.abs(100 * v - Math.round(100 * v)) < 1e-6 ? 0 : 1);
}

/** Metric name plus one synonym at random: "TPR (recall)". */
function metricLabel(k) {
  const m = METRIC[k], aka = m.aka ? m.aka.split(", ") : [];
  return aka.length ? `${m.name} (${pick(aka)})` : m.name;
}

/** Expected counts at prior p for a test with rates tpr and fpr. */
function countsAt(p, tpr, fpr, N) {
  const P = p * N, Q = N - P;
  return { tn: Q * (1 - fpr), fp: Q * fpr, fn: P * (1 - tpr), tp: P * tpr };
}

/** Log-uniform draw in [lo, hi]. */
function logUniform(lo, hi) {
  return Math.exp(Math.log(lo) + gr() * Math.log(hi / lo));
}

/** A prior as a student reads it: whole percent, or 0.1% when rare. */
function nicePrior(p) {
  return p >= 0.02 ? Math.round(100 * p) / 100 : Math.round(1000 * p) / 1000;
}

/** The current round of the current kind, made if there is none. */
function gRound() {
  const k = G.kind;
  if (!G.rounds[k]) G.rounds[k] = MAKE[k]();
  return G.rounds[k];
}

EXPLAIN.cheat = () => ({ n: gRound().s, who: "the classifier" });
for (const i of [0, 1]) {
  EXPLAIN[`game${i}`] = () => ({ c: G.rounds.wyr.opts[i].c,
    n: G.rounds.wyr.s, who: `classifier ${"AB"[i]}` });
  EXPLAIN[`shift${i}`] = () => ({ c: G.rounds.shift.c[i],
    n: G.rounds.shift.s, who: G.rounds.shift.s.test });
}

// ---------------------------------------------------------------- rounds

/**
 * Which number?: five metrics (the popular ones, or five of all of them),
 * one question each; both columns shuffled.
 */
function makeMatch() {
  const keys = SETTINGS.popular ? POPULAR
    : shuffle(METRICS.map(m => m.key)).slice(0, 5);
  const s = pick(SCENARIOS);
  return { kind: "match", s,
    qs: shuffle(keys.map(key => ({ key, text: pick(ASK[key])(s) }))),
    ms: shuffle(keys.map(key => ({ key, label: metricLabel(key) }))),
    links: keys.map(() => null), sel: null, done: false };
}

/**
 * New prior: priors at least 2x apart. Precision and accuracy must each
 * move by half a point or more, so neither reads "same" on screen while
 * the answer is up or down.
 */
function makeShift() {
  const s = pick(SCENARIOS);
  for (let tries = 0; tries < 20000; tries++) {
    const tpr = (50 + Math.floor(50 * gr())) / 100, fpr = pick(FPRS);
    const p = [0, 1].map(() => nicePrior(logUniform(...s.wide)));
    if (Math.max(...p) < 2 * Math.min(...p)) continue;
    const c = p.map(x => countsAt(x, tpr, fpr, 10000));
    const v = c.map(allMetrics);
    if (["ppv", "acc"].some(k => Math.abs(v[1][k] - v[0][k]) < 0.005)) {
      continue;
    }
    const move = k => (v[1][k] > v[0][k] ? "up" : "down");
    const ans = { tpr: "same", fpr: "same", ppv: move("ppv"),
      acc: move("acc") };
    return { kind: "shift", s, tpr, fpr, p, c, v, ans, picks: {},
      done: false };
  }
  throw new Error("no round found");
}

/** Mistakes per sample at prior p: misses plus false alarms. */
function errRate(o, p) { return p * (1 - o.tpr) + (1 - p) * o.fpr; }

/**
 * Would you rather?: two classifiers, the goal fewest mistakes. Kept when
 * the winner at the scenario's prior (by 20% fewer mistakes) would lose at
 * a 50% prior (by 10%): the one with better rates on balance loses
 * because one class is much bigger.
 */
function makeWyr() {
  const N = 10000, s = pick(SCENARIOS);
  for (let tries = 0; tries < 20000; tries++) {
    const prev = Math.round(100 * (s.prev[0]
      + gr() * (s.prev[1] - s.prev[0]))) / 100;
    const opts = [0, 1].map(() => ({
      tpr: (50 + Math.floor(50 * gr())) / 100, fpr: pick(FPRS) }));
    const m = opts.map(o => errRate(o, prev));
    const h = opts.map(o => errRate(o, 0.5));
    const win = m[0] < m[1] ? 0 : 1, lose = 1 - win;
    const P = Math.round(prev * N), Q = N - P;
    // Whole counts only, so "0.5% of 6,900" never rounds a half sample.
    const whole = v => Math.abs(v - Math.round(v)) < 1e-9;
    if (h[win] < h[lose] || (m[lose] - m[win]) / m[lose] < 0.2
      || (h[win] - h[lose]) / h[win] < 0.1
      || !opts.every(o => whole(o.fpr * Q) && whole((1 - o.tpr) * P))) {
      continue;
    }
    for (const o of opts) {
      const fn = Math.round((1 - o.tpr) * P), fp = Math.round(o.fpr * Q);
      o.c = { tn: Q - fp, fp, fn, tp: P - fn };
    }
    return { kind: "wyr", s, N, P, Q, prev, opts, win, h,
      names: { tpr: metricLabel("tpr"), fpr: metricLabel("fpr") },
      picked: null, done: false };
  }
  throw new Error("no round found");
}

const MAKE = { match: makeMatch, shift: makeShift, wyr: makeWyr };

// ----------------------------------------------------------------- build

function gBuild() {
  for (const id of ["g-kind", "g-body", "g-verdict", "g-score", "g-next",
    "g-cheat"]) {
    gEls[id] = document.getElementById(id);
  }
  for (const b of gEls["g-kind"].children) {
    b.onclick = () => setKind(b.dataset.kind);
  }
  gEls["g-next"].onclick = newRound;
  // Lines follow their endpoints when text wraps or feedback appears.
  new ResizeObserver(() => {
    if (G.kind === "match") mLines();
  }).observe(gEls["g-body"]);
  gCheat();
}

function gCheat() {
  gEls["g-cheat"].innerHTML = shownMetrics().map(m => `<div class="mrow
    cheat" data-explain="${m.key}"><span class="mname">${m.name}${m.aka
      ? `<span class="aka">${m.aka}</span>` : ""}</span>
    <span class="mdef">${defHTML(m.key)}</span></div>`).join("");
}

/** Apply the popular toggle: cheat sheet, and an unchecked match round. */
function gPopular() {
  gCheat();
  if (G.rounds.match && !G.rounds.match.done) G.rounds.match = null;
}

function setKind(k) {
  G.kind = k;
  gDraw();
}

function newRound() {
  G.rounds[G.kind] = MAKE[G.kind]();
  gDraw();
}

/** Add a finished round's k right answers out of n to the score. */
function score(k, n) {
  G.right += k;
  G.played += n;
  G.streak = k === n ? G.streak + 1 : 0;
}

function gDraw() {
  const rd = gRound();
  for (const b of gEls["g-kind"].children) {
    b.setAttribute("aria-checked", b.dataset.kind === G.kind);
  }
  // The cheat sheet's sentences would give Which number? away.
  if (G.kind === "match") delete gEls["g-cheat"].dataset.ctx;
  else gEls["g-cheat"].dataset.ctx = "cheat";
  if (G.kind === "match") {
    if (G.built !== rd) mBuild(rd);
    mSync();
  } else {
    G.built = null;
    DRAW[G.kind](rd);
  }
  gVerdict(rd);
  gEls["g-score"].innerHTML = `
    <div class="row"><span>Right</span><span class="val">${G.right} of
      ${G.played}</span></div>
    <div class="row" data-tip="Rounds in a row with every answer right">
      <span>Streak</span><span class="val">${G.streak}</span></div>`;
}

/** Verdict under a finished round, with a Next button. */
function gVerdict(rd) {
  const el = gEls["g-verdict"];
  if (!rd.done) {
    el.replaceChildren();
    return;
  }
  let k, n, head;
  if (rd.kind === "match") {
    n = rd.qs.length;
    k = rd.links.filter((j, i) => rd.ms[j].key === rd.qs[i].key).length;
    head = `${k} of ${n} right.`;
  } else if (rd.kind === "shift") {
    n = SHIFT_KEYS.length;
    k = SHIFT_KEYS.filter(m => rd.picks[m] === rd.ans[m]).length;
    head = `${k} of ${n} right.`;
  } else {
    n = 1;
    k = rd.picked === rd.win ? 1 : 0;
    head = `${k ? "Right!" : "Not this time."} Classifier ${"AB"[rd.win]} `
      + `makes fewer mistakes. ${wWhy(rd)}`;
  }
  el.innerHTML = `<p class="${k === n ? "yes" : "no"}">${head}</p>
    <div class="buttons"><button data-next>Next round &#9654;</button>
    </div>`;
  el.querySelector("[data-next]").onclick = newRound;
}

// --------------------------------------------------------- Which number?

function mBuild(rd) {
  G.built = rd;
  gEls["g-body"].innerHTML = `
    <h2>${rd.s.title}</h2>
    <p>Each question asks for one number. Draw a line from each question
      to the metric that answers it, or click one and then the other.</p>
    <div class="match">
      <svg class="m-lines" aria-hidden="true"></svg>
      <div class="m-col">${rd.qs.map((q, i) => `
        <button class="m-item q" data-side="q" data-i="${i}"><span
          class="m-text">&ldquo;${q.text}&rdquo;</span><span
          class="m-why"></span><span class="m-dot"></span></button>`)
        .join("")}</div>
      <div class="m-col m-ms">${rd.ms.map((m, j) => `
        <button class="m-item m" data-side="m" data-i="${j}"><span
          class="m-dot"></span>${m.label}</button>`).join("")}</div>
    </div>
    <div class="buttons"><button id="g-check">Check</button></div>`;
  const box = gEls["g-body"].querySelector(".match");
  for (const el of box.querySelectorAll(".m-item")) mItemEvents(el, rd);
  box.querySelector(".m-lines").addEventListener("click", e => {
    const i = e.target.dataset.i;
    if (i === undefined || rd.done) return;
    rd.links[Number(i)] = null;
    mSync();
  });
  document.getElementById("g-check").onclick = mCheck;
}

/** Link question i to metric j, freeing j from any other question. */
function mLink(i, j) {
  const rd = G.rounds.match;
  rd.links = rd.links.map(x => (x === j ? null : x));
  rd.links[i] = j;
  rd.sel = null;
  mSync();
}

/**
 * Drag from one column to the other draws a line; a click selects an
 * item, and a click on the other column then links the two. A click on a
 * linked item's dot removes its line.
 */
function mItemEvents(el, rd) {
  const side = el.dataset.side, i = Number(el.dataset.i);
  const linkTo = j => (side === "q" ? mLink(i, j) : mLink(j, i));
  el.addEventListener("pointerdown", e => {
    G.eat = false;
    if (rd.done || e.button > 0) return;
    G.drag = { side, i, x: e.clientX, y: e.clientY, moved: false };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", e => {
    const d = G.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) {
      return;
    }
    d.moved = true;
    mLines(e);
  });
  el.addEventListener("pointerup", e => {
    const d = G.drag;
    G.drag = null;
    if (!d || !d.moved) return;
    G.eat = true;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const t = hit && hit.closest(".m-item");
    if (t && t.dataset.side !== side) linkTo(Number(t.dataset.i));
    else mLines();
  });
  el.addEventListener("pointercancel", () => {
    G.drag = null;
    mLines();
  });
  el.addEventListener("click", e => {
    // A touch drag may fire no click, so a pending eat is dropped at
    // the next pointerdown; keyboard clicks (detail 0) are never eaten.
    if (G.eat && e.detail) {
      G.eat = false;
      return;
    }
    if (rd.done) return;
    if (e.target.closest(".m-dot") && el.classList.contains("linked")) {
      rd.links = rd.links.map((j, q) => ((side === "q" ? q === i : j === i)
        ? null : j));
      mSync();
      return;
    }
    const sel = rd.sel;
    if (sel && sel.side !== side) {
      linkTo(sel.i);
      return;
    }
    rd.sel = sel && sel.side === side && sel.i === i ? null : { side, i };
    mSync();
  });
}

/** Item states, feedback after Check, and the lines. */
function mSync() {
  const rd = G.rounds.match, root = gEls["g-body"];
  root.querySelector(".match").classList.toggle("done", rd.done);
  for (const el of root.querySelectorAll(".m-item")) {
    const side = el.dataset.side, i = Number(el.dataset.i);
    el.classList.toggle("linked", side === "q" ? rd.links[i] !== null
      : rd.links.includes(i));
    el.classList.toggle("sel", !!rd.sel && rd.sel.side === side
      && rd.sel.i === i);
    if (!rd.done || side !== "q") continue;
    const q = rd.qs[i], ok = rd.ms[rd.links[i]].key === q.key;
    const label = rd.ms.find(m => m.key === q.key).label;
    el.classList.add(ok ? "ok" : "bad");
    el.querySelector(".m-why").innerHTML = `<b>${ok ? "Right:"
      : `Answer: ${label}.`}</b> ${GENERIC[q.key](rd.s)}`;
  }
  const check = document.getElementById("g-check");
  check.hidden = rd.done;
  check.disabled = rd.links.includes(null);
  mLines();
}

/** S-curve from a to b, leaving and entering horizontally. */
function curve(a, b) {
  const k = (b.x - a.x) / 2;
  return `M${a.x},${a.y} C${a.x + k},${a.y} ${b.x - k},${b.y} ${b.x},${b.y}`;
}

/**
 * Redraw the lines between dot centers (in the match box's pixels), and
 * the line being dragged to the pointer of event e. A question being
 * redrawn hides its old line.
 */
function mLines(e) {
  const rd = G.rounds.match, box = gEls["g-body"].querySelector(".match");
  if (!rd || !box || G.built !== rd) return;
  const svg = box.querySelector(".m-lines"), B = box.getBoundingClientRect();
  const dots = side => [...box.querySelectorAll(`.m-item.${side} .m-dot`)]
    .map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - B.left,
        y: r.top + r.height / 2 - B.top };
    });
  const at = { q: dots("q"), m: dots("m") }, d = G.drag;
  svg.replaceChildren();
  rd.links.forEach((j, i) => {
    if (j === null || (d && d.moved && d.side === "q" && d.i === i)) return;
    const cls = rd.done ? (rd.ms[j].key === rd.qs[i].key ? " yes" : " no")
      : "";
    const path = curve(at.q[i], at.m[j]);
    node("path", { d: path, class: `m-line${cls}` }, svg);
    for (const p of [at.q[i], at.m[j]]) {
      node("circle", { cx: p.x, cy: p.y, r: 5, class: `m-end${cls}` }, svg);
    }
    if (!rd.done) node("path", { d: path, class: "m-hit", "data-i": i }, svg);
  });
  if (e && d && d.moved) {
    node("path", { d: curve(at[d.side][d.i], { x: e.clientX - B.left,
      y: e.clientY - B.top }), class: "m-line rubber" }, svg);
  }
}

function mCheck() {
  const rd = G.rounds.match;
  if (rd.done || rd.links.includes(null)) return false;
  rd.done = true;
  rd.sel = null;
  score(rd.links.filter((j, i) => rd.ms[j].key === rd.qs[i].key).length,
    rd.qs.length);
  gDraw();
  return true;
}

// ------------------------------------------------------------- New prior

// Why each answer holds, for round rd.
const SHIFT_WHY = {
  tpr: rd => `TPR is a share of the ${rd.s.pos} only, so the prior does `
    + "not move it.",
  fpr: rd => `FPR is a share of the ${rd.s.neg} only, so the prior does `
    + "not move it.",
  ppv: rd => {
    const up = rd.p[1] > rd.p[0];
    return "Precision weighs true alarms (prior × TPR) against false ones "
      + `((1 − prior) × FPR); ${up ? "more" : "fewer"} ${rd.s.pos} tip it `
      + `toward ${up ? "true" : "false"} alarms.`;
  },
  acc: rd => {
    const up = rd.p[1] > rd.p[0], s = rd.s;
    return `Accuracy is TPR (${pctR(rd.tpr)}) on the ${s.pos} and TNR `
      + `(${pctR(1 - rd.fpr)}) on the ${s.neg}, weighted by their share; `
      + `the ${up ? s.pos : s.neg} now make up more, so it moves toward `
      + `${up ? "TPR" : "TNR"}.`;
  },
};

function sDraw(rd) {
  const s = rd.s;
  const rows = SHIFT_KEYS.map(k => {
    const a = rd.picks[k], ok = a === rd.ans[k];
    const seg = MOVES.map(x => `<button role="radio" data-k="${k}"
      data-a="${x}" aria-checked="${a === x}"${rd.done ? " disabled" : ""}
      >${cap(x)}</button>`).join("");
    const out = rd.done ? `<p class="s-out"><b class="${ok ? "ok" : "bad"}">${
      ok ? "Right" : `Answer: ${cap(rd.ans[k])}`}.</b> ${pct(rd.v[0][k])}
      &rarr; ${pct(rd.v[1][k])}. ${SHIFT_WHY[k](rd)}</p>` : "";
    return `<div class="s-row"><span class="mname" data-explain="${k}">${
      METRIC[k].name}</span><div class="seg" role="radiogroup"
      aria-label="${METRIC[k].name}">${seg}</div>${out}</div>`;
  }).join("");
  const figs = rd.done ? `<div class="s-mosaics">${[0, 1].map(i => `
    <figure data-ctx="shift${i}"><svg class="mini-mosaic"
      viewBox="0 0 220 150"></svg><figcaption>${i ? "Second" : "First"}
      ${s.place}: prior ${pctR(rd.p[i])}</figcaption></figure>`).join("")}
    </div>` : "";
  gEls["g-body"].innerHTML = `
    <h2>${s.title}</h2>
    <p>${cap(s.test)} has TPR <b>${pctR(rd.tpr)}</b> and FPR
      <b>${pctR(rd.fpr)}</b>. It moves from one ${s.place} to another: at
      the first, <b>${pctR(rd.p[0])}</b> of ${s.pop} ${s.has1}; at the
      second, <b>${pctR(rd.p[1])}</b>.</p>
    <p class="wyr">At the second ${s.place}, what happens to each
      number?</p>
    <div class="s-rows" data-ctx="cheat">${rows}</div>
    ${rd.done ? "" : `<div class="buttons"><button id="g-check"${
      SHIFT_KEYS.every(k => rd.picks[k]) ? "" : " disabled"}>Check</button>
      </div>`}
    ${figs}`;
  for (const b of gEls["g-body"].querySelectorAll(".s-row button")) {
    b.onclick = () => {
      rd.picks[b.dataset.k] = b.dataset.a;
      gDraw();
    };
  }
  const check = document.getElementById("g-check");
  if (check) check.onclick = sCheck;
  gEls["g-body"].querySelectorAll(".s-mosaics svg").forEach((svg, i) => {
    drawMosaic(svg, rd.c[i], { x0: 4, x1: 216, y0: 4, y1: 146 },
      { labels: true });
  });
}

function sCheck() {
  const rd = G.rounds.shift;
  if (rd.done || !SHIFT_KEYS.every(k => rd.picks[k])) return false;
  rd.done = true;
  score(SHIFT_KEYS.filter(k => rd.picks[k] === rd.ans[k]).length,
    SHIFT_KEYS.length);
  gDraw();
  return true;
}

// ------------------------------------------------------ Would you rather?

function wDraw(rd) {
  const s = rd.s;
  gEls["g-body"].innerHTML = `
    <h2>${s.title}</h2>
    <p>${num(rd.N)} ${s.many}, prior ${pctR(rd.prev)}: <b>${num(rd.P)}</b>
      are ${s.pos} and <b>${num(rd.Q)}</b> are ${s.neg}.</p>
    <p class="goal"><b>Goal:</b> make the fewest mistakes overall (highest
      accuracy).</p>
    <p class="wyr">Would you rather use&hellip;</p>
    <div class="options"></div>`;
  gEls["g-body"].querySelector(".options")
    .replaceChildren(...rd.opts.map((o, i) => wCard(rd, o, i)));
}

function wCard(rd, o, i) {
  const card = document.createElement("div");
  card.className = "option card" + (rd.done ? (i === rd.win ? " win"
    : " lose") : "") + (rd.picked === i ? " picked" : "");
  card.dataset.ctx = `game${i}`;
  card.innerHTML = `<h3>Classifier ${"AB"[i]}</h3>` + ["tpr", "fpr"]
    .map(k => `<div class="clue" data-explain="${k}"><span class="cname">${
      rd.names[k]}</span><span class="cval">${pctR(o[k])}</span></div>`)
    .join("");
  if (!rd.done) {
    const b = document.createElement("button");
    b.className = "choose";
    b.textContent = `Choose ${"AB"[i]}`;
    b.onclick = () => wChoose(i);
    card.append(b);
    return card;
  }
  const c = o.c;
  card.insertAdjacentHTML("beforeend", `<div class="reveal">
    <p>Misses: ${pctR(1 - o.tpr)} of ${num(rd.P)} = <b>${num(c.fn)}</b></p>
    <p>False alarms: ${pctR(o.fpr)} of ${num(rd.Q)} =
      <b>${num(c.fp)}</b></p>
    <p class="goalval">${num(c.fn + c.fp)} mistakes (accuracy
      ${pct(metricValue("acc", c))})</p></div>`);
  const svg = node("svg", { viewBox: "0 0 220 150", class: "mini-mosaic" },
    card.querySelector(".reveal"));
  drawMosaic(svg, c, { x0: 4, x1: 216, y0: 4, y1: 146 }, { labels: true });
  return card;
}

/** Why the prior decided the round, and who would win at 50%. */
function wWhy(rd) {
  const s = rd.s, W = "AB"[rd.win], L = "AB"[1 - rd.win];
  const h = rd.h.map(x => num(x * rd.N));
  const big = rd.Q > rd.P
    ? `The ${num(rd.Q)} ${s.neg} outnumber the ${num(rd.P)} ${s.pos}, so `
      + `false alarms weigh more than misses, and ${W} has the lower FPR.`
    : `The ${num(rd.P)} ${s.pos} outnumber the ${num(rd.Q)} ${s.neg}, so `
      + `misses weigh more than false alarms, and ${W} has the higher TPR.`;
  return `${big} At a 50% prior, ${L} would win: ${h[1 - rd.win]} mistakes `
    + `to ${h[rd.win]} per ${num(rd.N)}.`;
}

function wChoose(i) {
  const rd = G.rounds.wyr;
  if (rd.done) return;
  rd.picked = i;
  rd.done = true;
  score(i === rd.win ? 1 : 0, 1);
  gDraw();
}

const DRAW = { shift: sDraw, wyr: wDraw };
const CHECK = { match: mCheck, shift: sCheck, wyr: () => false };

/**
 * Keys: 1, 2, 3 pick the kind; a or b choose; Enter checks or, once
 * done, goes on (n too). Enter on a focused button is left to it.
 */
function gKey(e) {
  const rd = gRound();
  if (["1", "2", "3"].includes(e.key)) {
    setKind(KINDS[Number(e.key) - 1]);
  } else if (rd.kind === "wyr" && !rd.done
    && (e.key === "a" || e.key === "b")) {
    wChoose(e.key === "a" ? 0 : 1);
  } else if (e.key === "n" && rd.done) {
    newRound();
  } else if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
    if (rd.done) newRound();
    else return CHECK[rd.kind]();
  } else {
    return false;
  }
  return true;
}
