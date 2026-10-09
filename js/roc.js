// ROC curve tab. Each sample gets a score; scores of Truth 0 samples are
// drawn from N(-sep/2, 1) and of Truth 1 samples from N(sep/2, 1). The
// classifier predicts 1 (red) when score >= threshold t, or, estimating
// backwards, when score <= t. The strip shows the scores (one band per
// true class) split by t into the four cells, shaded by the estimate; the
// ROC plot (FPR, TPR) traces the threshold as it moves.
//
// The ROC arithmetic runs on effective scores e = dir * score (dir = -1
// backwards), so "predict 1" is always e >= dir * t: backwards only
// mirrors the scores, never moves them on the page.

const SCORE = [-5.2, 5.2];
const MAX_N = 400;
const STRIP = { w: 1000, h: 300, x0: 70, x1: 980,
  bands: [{ y0: 40, y1: 142 }, { y0: 166, y1: 268 }], axis: 274 };
const PLOT = { w: 400, h: 392, x0: 58, x1: 384, y0: 14, y1: 340 };

const R = {
  n: 40,
  prev: 0.5,
  sep: 1.5,
  back: false,
  seed: 1,
  thr: 0.4,
  sweep: null,
  drag: null,
};

// From rRegen(): noise streams z[0], z[1]; scores per class sorted high to
// low (rs[0] Truth 0, rs[1] Truth 1); the same as effective scores (es);
// every sample by effective score, high to low (order); the staircase
// vertices; above[j] = # Truth 1 above the j-th highest Truth 0 (both
// effective); and the AUC.
let rz, rs, es, order, verts, above, auc;
const rEls = {};
const ROC_NOUNS = { pop: "samples", pos: "Truth 1 samples",
  neg: "Truth 0 samples", has1: "are Truth 1", has0: "are Truth 0" };

EXPLAIN.roc = () => ({ c: rCounts(), n: ROC_NOUNS, who: "the classifier",
  auc });

function dir() { return R.back ? -1 : 1; }

/** Threshold in effective-score units. */
function effThr() { return dir() * R.thr; }

function rCounts() {
  const t = effThr();
  const tp = es[1].filter(v => v >= t).length;
  const fp = es[0].filter(v => v >= t).length;
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
    .map(z => mean[c] + z).sort((a, b) => b - a));
  es = rs.map(a => a.map(v => dir() * v).sort((x, y) => y - x));
  order = [...es[0].map(s => ({ s, y: 0 })), ...es[1].map(s => ({ s, y: 1 }))]
    .sort((a, b) => b.s - a.s);
  verts = [[0, 0]];
  let tp = 0, fp = 0;
  for (const o of order) {
    if (o.y) tp++;
    else fp++;
    verts.push([fp / Q, tp / P]);
  }
  let k = 0;
  above = es[0].map(v => {
    while (k < P && es[1][k] > v) k++;
    return k;
  });
  auc = above.reduce((s, a) => s + a, 0) / (P * Q);
}

/** Threshold (score units) predicting exactly k samples as 1. */
function thrForK(k) {
  let e;
  if (k <= 0) e = order[0].s + 0.25;
  else if (k >= order.length) e = order[order.length - 1].s - 0.25;
  else e = (order[k - 1].s + order[k].s) / 2;
  return dir() * e;
}

function currentK() {
  const t = effThr();
  return order.filter(o => o.s >= t).length;
}

// ----------------------------------------------------------------- build

function rBuild() {
  for (const id of ["strip", "rocplot", "r-n", "r-nval",
    "r-prev", "r-prevval", "r-sep", "r-sepval",
    "r-sweep", "r-flip", "r-resample", "r-readout", "r-legend", "r-cm"]) {
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
  rEls["r-sep"].min = 0;
  rEls["r-sep"].max = 4;
  rEls["r-sep"].step = 0.1;
  slider("r-n", "n");
  slider("r-prev", "prev");
  slider("r-sep", "sep");
  rEls["r-sweep"].onclick = toggleSweep;
  rEls["r-flip"].onclick = () => {
    R.back = !R.back;
    rRegen();
    rDraw();
  };
  rEls["r-resample"].onclick = () => {
    R.seed++;
    noise();
    rRegen();
    rDraw();
  };
  stripEvents();
  plotEvents(rEls.rocplot);
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
  rEls["r-flip"].textContent = R.back ? "Undo backwards"
    : "Estimate backwards";
  const [lo, hi] = R.back ? ["&gt;", "&le;"] : ["&lt;", "&ge;"];
  rEls["r-legend"].innerHTML = `
    <span class="key"><span class="dot c0"></span>Truth 0</span>
    <span class="key"><span class="dot c1"></span>Truth 1</span>
    <span class="key"><span class="swatch est0"></span>Estimated blue
      (score ${lo} <i>t</i>)</span>
    <span class="key"><span class="swatch est1"></span>Estimated red
      (score ${hi} <i>t</i>)</span>`;
  const c = rCounts(), k = currentK();
  drawStrip(c);
  drawRoc(k);
  rReadout(c, k);
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
  // Class estimated left and right of the threshold.
  const side = R.back ? [1, 0] : [0, 1];
  const by = S.bands[0].y0 - 4, bh = S.bands[1].y1 - S.bands[0].y0 + 8;
  node("rect", { x: S.x0, y: by, width: tx - S.x0, height: bh,
    class: `est-bg c${side[0]}` }, svg);
  node("rect", { x: tx, y: by, width: S.x1 - tx, height: bh,
    class: `est-bg c${side[1]}` }, svg);
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
      const p = pos[cl][i];
      node("circle", { cx: p.x, cy: p.y, r: p.r - 0.6, class: `sd c${cl}` },
        svg);
    });
  }
  const g = node("g", { class: "thr" }, svg);
  node("line", { x1: tx, x2: tx, y1: 22, y2: S.bands[1].y1 + 4,
    class: "thr-line" }, g);
  node("circle", { cx: tx, cy: 22, r: 7, class: "thr-grip" }, g);
  text(`t = ${fmt(R.thr, 2)}`, { x: tx + 12, y: 32, class: "thr-label" }, g);
  // Region names, dropped when their side is too narrow to hold them.
  const name = ["blue", "red"];
  if (tx - S.x0 > 150) {
    text(`← Estimated ${name[side[0]]}`, { x: tx - 12, y: 13,
      class: `est-label c${side[0]}`, "text-anchor": "end" }, g);
  }
  if (S.x1 - tx > 150) {
    text(`Estimated ${name[side[1]]} →`, { x: tx + 12, y: 13,
      class: `est-label c${side[1]}` }, g);
  }
  // Cell of each (band, side): row = truth, column = the side's estimate.
  const cell = (truth, est) => [["tn", "fp"], ["fn", "tp"]][truth][est];
  for (const t of [0, 1]) {
    const y = S.bands[t].y0 + 14;
    for (const [j, x, cls] of [[0, tx - 10, "l"], [1, tx + 10, "r"]]) {
      const k = cell(t, side[j]);
      text(`${CELL_LABEL[k]} ${c[k]}`, { x, y,
        class: `quad cell-name ${k} ${cls}` }, svg);
    }
  }
}

/** Grid, ticks and axis labels; xk / yk are the labels' hover keys. */
function plotFrame(svg, xl, yl, xk, yk) {
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
    class: "axis-label", "text-anchor": "middle", "data-explain": xk }, svg);
  text(yl, { x: 0, y: 0, class: "axis-label", "text-anchor": "middle",
    "data-explain": yk,
    transform: `translate(16 ${(PLOT.y0 + PLOT.y1) / 2}) rotate(-90)` }, svg);
}

function pathOf(pts) {
  return pts.map((p, i) => `${i ? "L" : "M"}${px(p[0]).toFixed(1)} `
    + `${py(p[1]).toFixed(1)}`).join("");
}

function drawRoc(k) {
  const svg = rEls.rocplot;
  plotFrame(svg, "FPR (false alarm rate)", "TPR (recall)", "fpr", "tpr");
  node("path", { d: pathOf(verts) + `L${px(1)} ${py(0)}Z`,
    class: "auc-fill" }, svg);
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
    class: "auc-label", "text-anchor": "end", "data-explain": "auc" }, svg);
}

/**
 * The confusion matrix beside the ROC plot, and the metric rows (name,
 * fraction, value, as on the Confusion matrix tab) in the side panel.
 */
function rReadout(c, k) {
  const m = allMetrics(c);
  const td = k => `<td class="cm-cell ${k}" data-cell="${k}">${chip(k)} ${
    c[k]}</td>`;
  rEls["r-cm"].innerHTML = `
    <h3>At <i>t</i> = ${fmt(R.thr, 2)}</h3>
    <table class="cm mini"><thead><tr><th></th><th>Predict 0</th>
      <th>Predict 1</th></tr></thead><tbody>
      <tr><th>Truth 0</th>${td("tn")}${td("fp")}</tr>
      <tr><th>Truth 1</th>${td("fn")}${td("tp")}</tr>
    </tbody></table>`;
  const row = (key, def, val) => {
    const mt = METRIC[key];
    const name = mt ? `${mt.name}${mt.aka
      ? `<span class="aka">${mt.aka}</span>` : ""}` : key.toUpperCase();
    return `<div class="mrow static" data-explain="${key}">
      <span class="mname">${name}</span><span class="mdef">${def}</span>
      <span class="val">${val}</span></div>`;
  };
  rEls["r-readout"].innerHTML = `
    <h3>At threshold <i>t</i> = ${fmt(R.thr, 2)}</h3>
    <div class="mlist">
      ${["tpr", "fpr", "ppv", "acc"].map(key => row(key, defHTML(key),
        pct(m[key]))).join("")}
    </div>
    <h3>Over every threshold</h3>
    <div class="mlist">
      ${row("auc", '<span class="aka">area under the ROC curve</span>',
        auc.toFixed(3))}
    </div>
    ${verts[k][1] < verts[k][0] ? `<p class="warn">This point is below the
      diagonal: worse than guessing. Predicting the opposite would land at
      (${pct(1 - verts[k][0])}, ${pct(1 - verts[k][1])}). Try ${R.back
      ? "Undo backwards" : "Estimate backwards"}.</p>` : ""}`;
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

/** Vertex index nearest the pointer on the ROC plot. */
function nearestK(p) {
  let best = 0, bd = Infinity;
  verts.forEach((q, i) => {
    const d = (px(q[0]) - p.x) ** 2 + (py(q[1]) - p.y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

function plotEvents(svg) {
  const move = e => {
    R.thr = thrForK(nearestK(svgPoint(svg, e)));
    rDraw();
  };
  svg.addEventListener("pointerdown", e => {
    e.preventDefault();
    stopSweep();
    svg.setPointerCapture(e.pointerId);
    R.drag = "roc";
    move(e);
  });
  svg.addEventListener("pointermove", e => {
    if (R.drag === "roc") move(e);
  });
  const end = () => { R.drag = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
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
    R.thr = dir() * (hi + (lo - hi) * f);
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
  // Left lowers t: one more predicted 1, or one fewer when backwards.
  const k = currentK() + (e.key === "ArrowLeft" ? 1 : -1) * dir();
  R.thr = thrForK(clamp(k, 0, order.length));
  rDraw();
  return true;
}
