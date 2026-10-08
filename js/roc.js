// Summary metrics tab: AUC over every threshold and F1 at one. Each
// sample gets a score; scores of Truth 0 samples are
// drawn from N(-sep/2, 1) and of Truth 1 samples from N(sep/2, 1). The
// classifier predicts 1 when score >= threshold t. The strip shows the
// scores (one band per true class) split by t into the four cells; the
// ROC plot (FPR, TPR) and the PR plot (recall, precision) trace the
// threshold as it moves, and the Venn diagram shows F1 (Dice) at the
// current threshold. Lowering t past a Truth 1 sample steps the ROC
// staircase up, past a Truth 0 sample right.

const SCORE = [-5.2, 5.2];
const MAX_N = 400;
const STRIP = { w: 1000, h: 300, x0: 70, x1: 980,
  bands: [{ y0: 40, y1: 142 }, { y0: 166, y1: 268 }], axis: 274 };
const PLOT = { w: 400, h: 392, x0: 58, x1: 384, y0: 14, y1: 340 };

const R = {
  n: 40,
  prev: 0.5,
  sep: 1.5,
  // Sign of the noise: Estimate backwards negates it along with sep, so every
  // score changes sign.
  sign: 1,
  seed: 1,
  thr: 0.4,
  pairs: false,
  sweep: null,
  // Hovered pair cell { i, j } (i-th highest Truth 1, j-th highest
  // Truth 0) while showing AUC as pairs.
  pair: null,
  drag: null,
};

// From rRegen(): noise streams z[0], z[1]; scores per class sorted high to
// low (s[0] Truth 0, s[1] Truth 1); every sample sorted high to low
// (order); the staircase vertices; above[j] = # Truth 1 above the j-th
// highest Truth 0; and the AUC.
let rz, rs, order, verts, above, auc;
const rEls = {};
const ROC_NOUNS = { pop: "samples", pos: "Truth 1 samples",
  neg: "Truth 0 samples", has1: "are Truth 1", has0: "are Truth 0" };

EXPLAIN.roc = () => ({ c: rCounts(), n: ROC_NOUNS, who: "the classifier",
  auc });

function rCounts() {
  const tp = rs[1].filter(v => v >= R.thr).length;
  const fp = rs[0].filter(v => v >= R.thr).length;
  return { tn: rs[0].length - fp, fp, fn: rs[1].length - tp, tp };
}

function noise() {
  rz = [0, 1].map(c => {
    const r = rng(R.seed * 7919 + c + 1);
    return Array.from({ length: MAX_N }, () => gauss(r));
  });
}

function rRegen() {
  const P = clamp(Math.round(R.prev * R.n), 1, R.n - 1), Q = R.n - P;
  const mean = [-R.sep / 2, R.sep / 2];
  rs = [Q, P].map((m, c) => rz[c].slice(0, m)
    .map(z => mean[c] + R.sign * z).sort((a, b) => b - a));
  order = [...rs[0].map(s => ({ s, y: 0 })), ...rs[1].map(s => ({ s, y: 1 }))]
    .sort((a, b) => b.s - a.s);
  verts = [[0, 0]];
  let tp = 0, fp = 0;
  for (const o of order) {
    if (o.y) tp++;
    else fp++;
    verts.push([fp / Q, tp / P]);
  }
  let k = 0;
  above = rs[0].map(v => {
    while (k < P && rs[1][k] > v) k++;
    return k;
  });
  auc = above.reduce((s, a) => s + a, 0) / (P * Q);
}

/** Threshold putting exactly the top k samples at or above it. */
function thrForK(k) {
  if (k <= 0) return order[0].s + 0.25;
  if (k >= order.length) return order[order.length - 1].s - 0.25;
  return (order[k - 1].s + order[k].s) / 2;
}

function currentK() { return order.filter(o => o.s >= R.thr).length; }

// ----------------------------------------------------------------- build

function rBuild() {
  for (const id of ["strip", "rocplot", "prplot", "r-n", "r-nval",
    "r-prev", "r-prevval", "r-sep", "r-sepval", "r-pairs",
    "r-sweep", "r-flip", "r-resample", "r-readout", "r-legend",
    "r-pair-note", "r-venn", "r-venn-note", "r-f1"]) {
    rEls[id] = document.getElementById(id);
  }
  const slider = (id, key) => {
    rEls[id].oninput = () => {
      R[key] = Number(rEls[id].value);
      rRegen();
      rDraw();
    };
  };
  rEls["r-n"].min = 10;
  rEls["r-n"].max = 200;
  rEls["r-n"].step = 2;
  rEls["r-prev"].min = 0.05;
  rEls["r-prev"].max = 0.95;
  rEls["r-prev"].step = 0.01;
  rEls["r-sep"].min = -3;
  rEls["r-sep"].max = 4;
  rEls["r-sep"].step = 0.1;
  slider("r-n", "n");
  slider("r-prev", "prev");
  slider("r-sep", "sep");
  rEls["r-pairs"].onchange = () => {
    R.pairs = rEls["r-pairs"].checked;
    R.pair = null;
    rDraw();
  };
  rEls["r-sweep"].onclick = toggleSweep;
  rEls["r-flip"].onclick = () => {
    R.sign = -R.sign;
    R.sep = -R.sep;
    R.thr = -R.thr;
    rRegen();
    rDraw();
  };
  rEls["r-resample"].onclick = () => {
    R.seed++;
    noise();
    rRegen();
    rDraw();
  };
  rEls["r-legend"].innerHTML = `
    <span class="key"><span class="dot c0"></span>Truth 0</span>
    <span class="key"><span class="dot c1"></span>Truth 1</span>
    <span class="key"><span class="dot ring"></span>hollow: predicted
      wrong</span>
    <span class="key"><span class="swatch pred1"></span>Predict 1
      (score &ge; <i>t</i>)</span>`;
  stripEvents();
  plotEvents(rEls.rocplot, "roc");
  plotEvents(rEls.prplot, "pr");
  noise();
  rRegen();
}

// ------------------------------------------------------------- scales

function sxs(v) {
  return STRIP.x0 + (v - SCORE[0]) / (SCORE[1] - SCORE[0])
    * (STRIP.x1 - STRIP.x0);
}
function ixs(px) {
  return SCORE[0] + (px - STRIP.x0) / (STRIP.x1 - STRIP.x0)
    * (SCORE[1] - SCORE[0]);
}
function px(v) { return PLOT.x0 + v * (PLOT.x1 - PLOT.x0); }
function py(v) { return PLOT.y1 - v * (PLOT.y1 - PLOT.y0); }

// --------------------------------------------------------------- draw

function rDraw() {
  rEls["r-n"].value = R.n;
  rEls["r-nval"].textContent = `${R.n} (${rs[1].length} Truth 1, `
    + `${rs[0].length} Truth 0)`;
  rEls["r-prev"].value = R.prev;
  rEls["r-prevval"].textContent = pct(rs[1].length / R.n);
  rEls["r-sep"].value = R.sep;
  rEls["r-sepval"].textContent = `${fmt(R.sep, 1)} (mean of Truth 1 minus `
    + `mean of Truth 0)`;
  rEls["r-sweep"].textContent = R.sweep ? "■ Stop" : "▶ Sweep";
  rEls["r-flip"].textContent = R.sign > 0 ? "Estimate backwards"
    : "Undo backwards";
  rEls["r-pair-note"].hidden = !R.pairs;
  const c = rCounts(), k = currentK();
  drawStrip(c);
  drawRoc(k);
  drawPr(k);
  rReadout(c, k);
  rEls["r-f1"].innerHTML = formulaHTML("f1", c);
  drawVenn(rEls["r-venn"], rEls["r-venn-note"], c);
}

/**
 * Dot positions: exact score on x; stacked upward from the band floor in
 * bins one dot wide, the radius shrinking until the tallest stack fits.
 */
function dotLayout() {
  const out = [[], []];
  let r = 7;
  for (; r > 2; r -= 0.25) {
    const ok = [0, 1].every(c => {
      const H = STRIP.bands[c].y1 - STRIP.bands[c].y0 - 4;
      const counts = new Map();
      let top = 0;
      for (const s of rs[c]) {
        const b = Math.floor((sxs(s) - STRIP.x0) / (2 * r));
        const m = (counts.get(b) || 0) + 1;
        counts.set(b, m);
        top = Math.max(top, m);
      }
      return top * 2 * r <= H;
    });
    if (ok) break;
  }
  for (const c of [0, 1]) {
    const counts = new Map();
    // Lowest scores first, so the stack order reads left to right.
    for (let i = rs[c].length - 1; i >= 0; i--) {
      const s = rs[c][i];
      const b = Math.floor((sxs(s) - STRIP.x0) / (2 * r));
      const m = counts.get(b) || 0;
      counts.set(b, m + 1);
      out[c][i] = { x: sxs(s), y: STRIP.bands[c].y1 - r - 2 * r * m, r };
    }
  }
  return out;
}

function drawStrip(c) {
  const svg = rEls.strip, S = STRIP;
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${S.w} ${S.h + 26}`);
  const tx = clamp(sxs(R.thr), S.x0, S.x1);
  node("rect", { x: tx, y: S.bands[0].y0 - 4, width: S.x1 - tx,
    height: S.bands[1].y1 - S.bands[0].y0 + 8, class: "pred1-bg" }, svg);
  for (const [i, b] of S.bands.entries()) {
    node("line", { x1: S.x0, x2: S.x1, y1: b.y1, y2: b.y1,
      class: "band-floor" }, svg);
    text(`Truth ${i}`, { x: S.x0 - 10, y: (b.y0 + b.y1) / 2 + 5,
      class: `band-label c${i}`, "text-anchor": "end" }, svg);
  }
  for (let v = -5; v <= 5; v++) {
    const x = sxs(v);
    node("line", { x1: x, x2: x, y1: S.axis, y2: S.axis + 5,
      class: "frame" }, svg);
    text(fmt(v, 0), { x, y: S.axis + 20, class: "tick",
      "text-anchor": "middle" }, svg);
  }
  text("score", { x: S.x1, y: S.axis + 20, class: "axis-label",
    "text-anchor": "end" }, svg);

  const pos = dotLayout();
  for (const cl of [0, 1]) {
    rs[cl].forEach((s, i) => {
      const p = pos[cl][i], right = (s >= R.thr) === (cl === 1);
      node("circle", { cx: p.x, cy: p.y, r: p.r - 0.6,
        class: `sd c${cl}${right ? "" : " wrong"}` }, svg);
    });
  }
  if (R.pair) {
    const a = pos[1][R.pair.i], b = pos[0][R.pair.j];
    node("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "pair-link" },
      svg);
    for (const p of [a, b]) {
      node("circle", { cx: p.x, cy: p.y, r: p.r + 4, class: "pair-ring" },
        svg);
    }
  }

  const g = node("g", { class: "thr" }, svg);
  node("line", { x1: tx, x2: tx, y1: 22, y2: S.bands[1].y1 + 4,
    class: "thr-line" }, g);
  node("circle", { cx: tx, cy: 22, r: 7, class: "thr-grip" }, g);
  text(`t = ${fmt(R.thr, 2)}`, { x: tx + 12, y: 14, class: "thr-label" }, g);
  text("← Predict 0", { x: tx - 12, y: 14, class: "thr-side",
    "text-anchor": "end" }, g);
  const q = (k, x, y, side) => text(`${CELL_LABEL[k]} ${c[k]}`, { x, y,
    class: `quad cell-name ${k} ${side}` }, svg);
  q("tn", tx - 10, S.bands[0].y0 + 14, "l");
  q("fp", tx + 10, S.bands[0].y0 + 14, "r");
  q("fn", tx - 10, S.bands[1].y0 + 14, "l");
  q("tp", tx + 10, S.bands[1].y0 + 14, "r");
}

function plotFrame(svg, xl, yl) {
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${PLOT.w} ${PLOT.h}`);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    node("line", { x1: px(v), x2: px(v), y1: PLOT.y0, y2: PLOT.y1,
      class: "grid" }, svg);
    node("line", { x1: PLOT.x0, x2: PLOT.x1, y1: py(v), y2: py(v),
      class: "grid" }, svg);
  }
  for (const v of [0, 0.5, 1]) {
    text(`${v}`, { x: px(v), y: PLOT.y1 + 17, class: "tick",
      "text-anchor": "middle" }, svg);
    text(`${v}`, { x: PLOT.x0 - 8, y: py(v) + 4, class: "tick",
      "text-anchor": "end" }, svg);
  }
  text(xl, { x: (PLOT.x0 + PLOT.x1) / 2, y: PLOT.h - 12,
    class: "axis-label", "text-anchor": "middle" }, svg);
  text(yl, { x: 0, y: 0, class: "axis-label", "text-anchor": "middle",
    transform: `translate(16 ${(PLOT.y0 + PLOT.y1) / 2}) rotate(-90)` }, svg);
}

function pathOf(pts) {
  return pts.map((p, i) => `${i ? "L" : "M"}${px(p[0]).toFixed(1)} `
    + `${py(p[1]).toFixed(1)}`).join("");
}

function drawRoc(k) {
  const svg = rEls.rocplot, Q = rs[0].length, P = rs[1].length;
  plotFrame(svg, "FPR (false alarm rate)", "TPR (recall)");
  if (R.pairs) {
    // Column j is the j-th highest Truth 0; its cells under the curve are
    // the Truth 1 samples scoring above it: correctly ordered pairs.
    const w = (PLOT.x1 - PLOT.x0) / Q, h = (PLOT.y1 - PLOT.y0) / P;
    above.forEach((a, j) => {
      node("rect", { x: px(j / Q), y: py(a / P), width: w + 0.3,
        height: a * h, class: "pair-ok" }, svg);
      node("rect", { x: px(j / Q), y: PLOT.y0, width: w + 0.3,
        height: (P - a) * h, class: "pair-bad" }, svg);
    });
    if (P <= 60 && Q <= 60) {
      for (let j = 1; j < Q; j++) {
        node("line", { x1: px(j / Q), x2: px(j / Q), y1: PLOT.y0,
          y2: PLOT.y1, class: "pair-grid" }, svg);
      }
      for (let i = 1; i < P; i++) {
        node("line", { x1: PLOT.x0, x2: PLOT.x1, y1: py(i / P),
          y2: py(i / P), class: "pair-grid" }, svg);
      }
    }
    if (R.pair) {
      node("rect", { x: px(R.pair.j / Q), y: py((R.pair.i + 1) / P),
        width: w, height: h, class: "pair-cell" }, svg);
    }
  } else {
    node("path", { d: pathOf(verts) + `L${px(1)} ${py(0)}Z`,
      class: "auc-fill" }, svg);
  }
  node("rect", { x: PLOT.x0, y: PLOT.y0, width: PLOT.x1 - PLOT.x0,
    height: PLOT.y1 - PLOT.y0, class: "frame" }, svg);
  node("line", { x1: px(0), y1: py(0), x2: px(1), y2: py(1),
    class: "chance" }, svg);
  text("guessing", { x: px(0.62), y: py(0.56), class: "chance-label",
    transform: `rotate(-45 ${px(0.62)} ${py(0.56)})` }, svg);
  node("path", { d: pathOf(verts), class: "curve-all" }, svg);
  node("path", { d: pathOf(verts.slice(0, k + 1)), class: "curve-traced" },
    svg);
  const [x, y] = verts[k];
  node("circle", { cx: px(x), cy: py(y), r: 6.5, class: "cur" }, svg);
  text(`AUC = ${auc.toFixed(3)}`, { x: px(0.97), y: py(0.04),
    class: "auc-label", "text-anchor": "end" }, svg);
}

function prPoints() {
  const P = rs[1].length, pts = [];
  let tp = 0;
  order.forEach((o, i) => {
    if (o.y) tp++;
    pts.push([tp / P, tp / (i + 1)]);
  });
  return pts;
}

function drawPr(k) {
  const svg = rEls.prplot, pts = prPoints(), base = rs[1].length / R.n;
  plotFrame(svg, "Recall (TPR)", "Precision (PPV)");
  node("rect", { x: PLOT.x0, y: PLOT.y0, width: PLOT.x1 - PLOT.x0,
    height: PLOT.y1 - PLOT.y0, class: "frame" }, svg);
  node("line", { x1: px(0), x2: px(1), y1: py(base), y2: py(base),
    class: "chance" }, svg);
  text(`guessing: precision = prior = ${pct(base)}`, { x: px(0.98),
    y: py(base) - 6, class: "chance-label", "text-anchor": "end" }, svg);
  node("path", { d: pathOf(pts), class: "curve-all" }, svg);
  if (k >= 1) {
    node("path", { d: pathOf(pts.slice(0, k)), class: "curve-traced" }, svg);
    const [x, y] = pts[k - 1];
    node("circle", { cx: px(x), cy: py(y), r: 6.5, class: "cur" }, svg);
  } else {
    text("t above every score: nothing predicted 1, precision undefined",
      { x: px(0.5), y: py(0.5), class: "chance-label",
        "text-anchor": "middle" }, svg);
  }
}

function rReadout(c, k) {
  const m = allMetrics(c), P = rs[1].length, Q = rs[0].length;
  const good = Math.round(auc * P * Q);
  const row = (a, b, key) => `<div class="row" data-explain="${key}">`
    + `<span>${a}</span><span class="val">${b}</span></div>`;
  rEls["r-readout"].innerHTML = `
    <h3>At threshold <i>t</i> = ${fmt(R.thr, 2)}</h3>
    <table class="cm mini"><thead><tr><th></th><th>Predict 0</th>
      <th>Predict 1</th></tr></thead><tbody>
      <tr><th>Truth 0</th><td class="cm-cell tn" data-cell="tn">${
        chip("tn")} ${c.tn}</td>
        <td class="cm-cell fp" data-cell="fp">${chip("fp")} ${c.fp}</td></tr>
      <tr><th>Truth 1</th><td class="cm-cell fn" data-cell="fn">${
        chip("fn")} ${c.fn}</td>
        <td class="cm-cell tp" data-cell="tp">${chip("tp")} ${c.tp}</td></tr>
    </tbody></table>
    ${row("TPR (recall)", pct(m.tpr), "tpr")}
    ${row("FPR", pct(m.fpr), "fpr")}
    ${row("Precision", pct(m.ppv), "ppv")}
    ${row("Accuracy", pct(m.acc), "acc")}
    <h3>Over every threshold</h3>
    ${row("AUC", auc.toFixed(3), "auc")}
    <p class="muted">${num(good)} of the ${num(P * Q)} (Truth 1, Truth 0)
      pairs are ordered correctly: the Truth 1 sample scores higher.
      AUC = ${num(good)} / ${num(P * Q)}.</p>
    ${verts[k][1] < verts[k][0] ? `<p class="warn">This point is below the
      diagonal: worse than guessing. Predicting the opposite would land at
      (${pct(1 - verts[k][0])}, ${pct(1 - verts[k][1])}). Try Estimate
      backwards.</p>` : ""}`;
}

// ------------------------------------------------------------ interaction

function stripEvents() {
  const svg = rEls.strip;
  const move = e => {
    R.thr = clamp(ixs(svgPoint(svg, e).x), SCORE[0], SCORE[1]);
    rDraw();
  };
  svg.addEventListener("pointerdown", e => {
    e.preventDefault();
    stopSweep();
    svg.setPointerCapture(e.pointerId);
    R.drag = "strip";
    move(e);
  });
  svg.addEventListener("pointermove", e => {
    if (R.drag === "strip") move(e);
  });
  const end = () => { R.drag = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
}

/** Vertex index nearest the pointer on the ROC or PR plot. */
function nearestK(kind, p) {
  const pts = kind === "roc" ? verts : [[0, 1], ...prPoints()];
  let best = 0, bd = Infinity;
  pts.forEach((q, i) => {
    const d = (px(q[0]) - p.x) ** 2 + (py(q[1]) - p.y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

function plotEvents(svg, kind) {
  const move = e => {
    R.thr = thrForK(nearestK(kind, svgPoint(svg, e)));
    rDraw();
  };
  svg.addEventListener("pointerdown", e => {
    e.preventDefault();
    stopSweep();
    svg.setPointerCapture(e.pointerId);
    R.drag = kind;
    move(e);
  });
  svg.addEventListener("pointermove", e => {
    if (R.drag === kind) {
      move(e);
      return;
    }
    if (kind !== "roc" || !R.pairs) return;
    const p = svgPoint(svg, e), Q = rs[0].length, P = rs[1].length;
    const fx = (p.x - PLOT.x0) / (PLOT.x1 - PLOT.x0);
    const fy = (PLOT.y1 - p.y) / (PLOT.y1 - PLOT.y0);
    const pair = fx >= 0 && fx < 1 && fy >= 0 && fy < 1
      ? { j: Math.floor(fx * Q), i: Math.floor(fy * P) } : null;
    if (JSON.stringify(pair) !== JSON.stringify(R.pair)) {
      R.pair = pair;
      rDraw();
      showPair();
    }
  });
  const end = () => { R.drag = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("pointerleave", () => {
    if (R.pair) {
      R.pair = null;
      rDraw();
      showPair();
    }
  });
}

function showPair() {
  const el = rEls["r-pair-note"];
  if (!R.pair) {
    el.innerHTML = "Hover a cell of the ROC plot: each is one (Truth 1, "
      + "Truth 0) pair, ringed on the strip.";
    return;
  }
  const a = rs[1][R.pair.i], b = rs[0][R.pair.j], ok = a > b;
  el.innerHTML = `This pair: Truth 1 scores ${fmt(a)}, Truth 0 scores
    ${fmt(b)}. ${ok ? "Ordered correctly: the cell is under the curve."
    : "Ordered wrong: the cell is above the curve."}`;
}

function toggleSweep() {
  if (R.sweep) {
    stopSweep();
    rDraw();
    return;
  }
  const hi = order[0].s + 0.3, lo = order[order.length - 1].s - 0.3;
  const t0 = performance.now(), ms = 6000;
  R.sweep = requestAnimationFrame(function tick(now) {
    const f = Math.min(1, (now - t0) / ms);
    R.thr = hi + (lo - hi) * f;
    if (f < 1) R.sweep = requestAnimationFrame(tick);
    else R.sweep = null;
    rDraw();
  });
}

function stopSweep() {
  if (R.sweep) cancelAnimationFrame(R.sweep);
  R.sweep = null;
}

function rKey(e) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return false;
  stopSweep();
  const k = currentK() + (e.key === "ArrowLeft" ? 1 : -1);
  R.thr = thrForK(clamp(k, 0, order.length));
  rDraw();
  return true;
}
