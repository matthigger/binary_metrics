// Confusion matrix tab: an editable 2 x 2 table of counts, the same counts
// as a mosaic with draggable dividers, a guided tour that highlights each
// metric's numerator (filled) and denominator (outlined), and a list of
// the metrics. "Just the popular ones" (SETTINGS.popular) trims the list
// and skips the tour steps marked full.

const PRESETS = {
  coin: {
    name: "Coin flip",
    counts: { tn: 250, fp: 250, fn: 250, tp: 250 },
    nouns: { pop: "samples", pos: "class 1 samples",
      neg: "class 0 samples", has1: "are class 1", has0: "are class 0",
      test: "the coin flip", t0: "Class 0", t1: "Class 1",
      p0: "Tails", p1: "Heads" },
    source: "A classifier that ignores each sample and flips a fair coin "
      + "(heads predicts 1), on 1,000 samples with equal priors: 500 of "
      + "each class. It is right half the time: chance accuracy.",
  },
  strep: {
    name: "Strep test",
    // 37% prior; sensitivity 86%, specificity 95%.
    counts: { tn: 601, fp: 29, fn: 52, tp: 318 },
    nouns: { pop: "children with a sore throat", pos: "children with strep",
      neg: "children without strep", has1: "have strep",
      has0: "don't have strep", test: "the rapid strep test",
      t0: "No strep", t1: "Strep", p0: "Test negative",
      p1: "Test positive" },
    source: "A rapid strep test on 1,000 children with a sore throat. "
      + "Rates from published reviews: 37% of children with a sore "
      + "throat have strep (Shaikh et al. 2010); the rapid test has "
      + "sensitivity 86% and specificity 95% (Cohen et al. 2016).",
  },
  mammo: {
    name: "Mammogram",
    counts: { tn: 901, fp: 89, fn: 1, tp: 9 },
    nouns: { pop: "women screened", pos: "women with breast cancer",
      neg: "women without breast cancer", has1: "have breast cancer",
      has0: "don't have breast cancer", test: "the mammogram",
      t0: "No cancer", t1: "Cancer", p0: "Negative", p1: "Positive" },
    source: "Screening 1,000 women, with the classic teaching numbers: "
      + "prior 1%, sensitivity 90%, false alarm rate 9% "
      + "(Gigerenzer et al. 2007).",
  },
};

// Tour steps: hl is the metric highlighted, also a second metric sharing
// its denominator, full marks a step skipped under "Just the popular ones";
// text(x) is the step's HTML from the context x (x.full: all metrics on).
const STEPS = [
  { title: "Four outcomes", hl: null, text: x => `
    <p>Each of the ${num(x.N)} ${x.n.pop} lands in one cell. The row is
      the truth; the column is what ${x.n.test} predicts. A cell's name
      answers two questions:</p>
    <ul class="names">
      <li><b>True / False:</b> was the prediction right?</li>
      <li><b>Positive / Negative:</b> what was predicted?</li>
    </ul>
    <ul class="cells">
      <li>${chip("tn")} ${num(x.c.tn)} ${x.n.neg}, predicted negative</li>
      <li>${chip("fp")} ${num(x.c.fp)} ${x.n.neg}, predicted positive:
        a <b>false alarm</b> (type I error)</li>
      <li>${chip("fn")} ${num(x.c.fn)} ${x.n.pos}, predicted negative:
        a <b>missed detection</b> (type II error)</li>
      <li>${chip("tp")} ${num(x.c.tp)} ${x.n.pos}, predicted positive</li>
    </ul>
    <p class="muted">Divided by N, the four counts are the joint
      distribution of (truth, prediction). Edit any of them in the
      table.</p>` },
  { title: "Prior", hl: "prev", text: x => `
    <p>How common is the condition, before any test? ${num(x.n1)} of the
      ${num(x.N)} ${x.n.has1}.</p>
    ${formulaHTML("prev", x.c)}
    <p class="muted">The prior describes the population, not the test.
      Still, several metrics below depend on it.</p>` },
  { title: "Accuracy", hl: "acc", text: x => `
    <p>How often is ${x.n.test} right? It is right for the cells on the
      diagonal.</p>
    ${formulaHTML("acc", x.c)}
    <p class="muted">Careful when the condition is rare: a test that
      always says negative is right for everyone without it, an accuracy
      of 1 &minus; prior = ${pct(1 - x.m.prev)}.</p>` },
  { title: "Out of the Truth 1 row", hl: "tpr", also: "fnr", text: x => `
    <p>Of the ${num(x.n1)} ${x.n.pos}, ${x.n.test} catches
      ${num(x.c.tp)}:</p>
    ${formulaHTML("tpr", x.c)}
    ${x.full ? `<p>and misses ${num(x.c.fn)}:</p>
    ${formulaHTML("fnr", x.c)}
    <p class="muted">The two add to 100%.</p>` : ""}
    <p class="muted">TPR uses only the Truth 1 row: it says nothing about
      the ${x.n.neg}.</p>` },
  { title: "Out of the Truth 0 row", hl: "fpr", also: "tnr", text: x => `
    <p>Of the ${num(x.n0)} ${x.n.neg}, ${x.n.test} raises a false alarm
      for ${num(x.c.fp)}:</p>
    ${formulaHTML("fpr", x.c)}
    ${x.full ? `<p>and correctly clears ${num(x.c.tn)}:</p>
    ${formulaHTML("tnr", x.c)}
    <p class="muted">FPR = 1 &minus; TNR.</p>` : ""}
    <p class="muted">The ROC curve (Summary metrics tab) plots TPR against
      FPR.</p>` },
  { title: "Out of the Predict 1 column", hl: "ppv", also: "fdr",
    text: x => `
    <p>${cap(x.n.test)} says positive for ${num(x.pp)}. How many of them
      really ${x.n.has1}? ${num(x.c.tp)}:</p>
    ${formulaHTML("ppv", x.c)}
    ${x.full ? `<p>The other ${num(x.c.fp)} are false alarms:</p>
    ${formulaHTML("fdr", x.c)}` : ""}
    <p class="muted">Precision answers the question asked after a
      positive result: should I believe it?</p>` },
  { title: "Out of the Predict 0 column", hl: "npv", also: "for", full: true,
    text: x => `
    <p>${cap(x.n.test)} says negative for ${num(x.pn)}. How many of them
      really ${x.n.has0}? ${num(x.c.tn)}:</p>
    ${formulaHTML("npv", x.c)}
    <p>The other ${num(x.c.fn)} are missed:</p>
    ${formulaHTML("for", x.c)}` },
  { title: "Rows describe the test; columns depend on the prior",
    hl: null, rows: true, text: x => `
    <p>The row ratios use one true class each, so they describe the test
      itself. The column ratios mix both rows, so they also depend on how
      common the condition is.</p>
    <p><b>Drag the line between the rows</b>${T.view !== "mosaic"
      ? " (switch to the Mosaic view first)" : T.toScale ? ""
      : " (turn on Rows to scale first)"}: the prior changes, the row
      ratios stay put and the column ratios move.</p>
    <div class="compare">
      <div><h4>Rows</h4>
        <div>TPR <b>${pct(x.m.tpr)}</b></div>
        <div>FPR <b>${pct(x.m.fpr)}</b></div></div>
      <div><h4>Columns</h4>
        <div>Precision <b>${pct(x.m.ppv)}</b></div>
        ${x.full ? `<div>NPV <b>${pct(x.m.npv)}</b></div>` : ""}</div>
      <div><h4>Neither</h4>
        <div>Prior <b>${pct(x.m.prev)}</b></div>
        <div>Accuracy <b>${pct(x.m.acc)}</b></div></div>
    </div>` },
  { title: "Balanced accuracy", hl: "bacc", full: true, text: x => `
    <p>The average of the two row ratios that count correct
      predictions:</p>
    ${formulaHTML("bacc", x.c)}
    <p class="muted">Each true class counts equally however rare it is,
      so a test that always says negative scores 50% (TPR 0%, TNR
      100%).</p>` },
];

const MBOX = { x0: 124, x1: 512, y0: 34, y1: 466 };

const T = {
  preset: "strep",
  counts: null,
  step: 0,
  // Metric key under the pointer in the list, or the hovered cell.
  hoverMetric: null,
  hoverCell: null,
  toScale: true,
  // Which picture of the counts the box shows: "table" or "mosaic".
  view: "table",
  drag: null,
};

const tEls = {};

function nouns() { return PRESETS[T.preset].nouns; }

EXPLAIN.table = () => ({ c: T.counts, n: nouns(), who: nouns().test });

function tCtx() {
  const c = T.counts;
  return { c, n: nouns(), m: allMetrics(c), N: cellSum(c, CELLS),
    full: !SETTINGS.popular,
    n0: c.tn + c.fp, n1: c.fn + c.tp, pp: c.fp + c.tp, pn: c.tn + c.fn };
}

/** Tour steps in force under the toggle. */
function steps() { return STEPS.filter(s => !s.full || !SETTINGS.popular); }

function stepOf(key) {
  return steps().findIndex(s => s.hl === key || s.also === key);
}

/** Highlight in force: hovered cell, else hovered metric, else the step. */
function tHighlight() {
  if (T.hoverCell) return { num: [T.hoverCell], den: [] };
  if (T.hoverMetric) return highlightOf(T.hoverMetric);
  return highlightOf(steps()[T.step].hl);
}

// ------------------------------------------------------------------ build

function tBuild() {
  for (const id of ["presets", "toscale", "cm-table", "mosaic",
    "story-count", "story-title", "story-body", "story-back",
    "story-next", "mlist", "t-view", "toscale-row"]) {
    tEls[id] = document.getElementById(id);
  }
  for (const [key, p] of Object.entries(PRESETS)) {
    const b = document.createElement("button");
    b.textContent = p.name;
    b.dataset.preset = key;
    b.dataset.tip = p.source;
    b.setAttribute("role", "radio");
    b.onclick = () => setPreset(key);
    tEls.presets.append(b);
  }
  tEls.toscale.onchange = () => {
    T.toScale = tEls.toscale.checked;
    tDraw();
  };
  for (const b of tEls["t-view"].children) {
    b.onclick = () => {
      T.view = b.dataset.view;
      T.hoverCell = null;
      tDraw();
    };
  }
  tEls["story-back"].onclick = () => setStep(T.step - 1);
  tEls["story-next"].onclick = () => setStep(T.step + 1);
  buildTable();
  buildList();
  buildMosaicEvents();
}

function buildTable() {
  const cell = k => `<td class="cm-cell ${k}" data-cell="${k}">
    <label>${CELL_LABEL[k]}<input type="number" min="0" step="1"
      data-cell="${k}" aria-label="${CELL_LABEL[k]} count"></label>
    <span class="prop" data-prop="${k}"></span></td>`;
  tEls["cm-table"].innerHTML = `<table class="cm">
    <thead><tr><th></th>
      <th>Predict 0<span class="noun" data-noun="p0"></span></th>
      <th>Predict 1<span class="noun" data-noun="p1"></span></th>
      <th class="tot">Total</th></tr></thead>
    <tbody>
      <tr><th>Truth 0<span class="noun" data-noun="t0"></span></th>
        ${cell("tn")}${cell("fp")}<td class="tot" data-tot="n0"></td></tr>
      <tr><th>Truth 1<span class="noun" data-noun="t1"></span></th>
        ${cell("fn")}${cell("tp")}<td class="tot" data-tot="n1"></td></tr>
      <tr class="tot"><th>Total</th><td data-tot="pn"></td>
        <td data-tot="pp"></td><td data-tot="N"></td></tr>
    </tbody></table>`;
  for (const inp of tEls["cm-table"].querySelectorAll("input")) {
    inp.oninput = () => {
      const v = Number(inp.value);
      if (!Number.isInteger(v) || v < 0 || v > 1e7) return;
      T.counts[inp.dataset.cell] = v;
      tDraw();
    };
    inp.onblur = () => { inp.value = T.counts[inp.dataset.cell]; };
  }
  for (const td of tEls["cm-table"].querySelectorAll("td.cm-cell")) {
    td.onmouseenter = () => hoverCell(td.dataset.cell);
    td.onmouseleave = () => hoverCell(null);
  }
}

function buildList() {
  let html = "";
  const shown = shownMetrics();
  for (const g of GROUPS) {
    const ms = shown.filter(m => m.group === g.key);
    if (!ms.length) continue;
    html += `<h4>${g.title}</h4>`;
    for (const m of ms) {
      html += `<div class="mrow" data-key="${m.key}"
        data-explain="${m.key}">
        <span class="mname">${m.name}${m.aka
          ? `<span class="aka">${m.aka}</span>` : ""}</span>
        <span class="mdef">${defHTML(m.key)}</span>
        <span class="val" data-val="${m.key}"></span></div>`;
    }
  }
  tEls.mlist.innerHTML = html;
  for (const row of tEls.mlist.querySelectorAll(".mrow")) {
    row.onmouseenter = () => {
      T.hoverMetric = row.dataset.key;
      tDraw();
    };
    row.onmouseleave = () => {
      T.hoverMetric = null;
      tDraw();
    };
    row.onclick = () => setStep(stepOf(row.dataset.key));
  }
}

/** Apply the "Just the popular ones" toggle, staying on the same step. */
function tPopular() {
  const cur = steps()[T.step];
  buildList();
  const i = steps().indexOf(cur);
  T.step = i >= 0 ? i : Math.min(T.step, steps().length - 1);
  T.hoverMetric = null;
}

function hoverCell(k) {
  T.hoverCell = k;
  tDraw();
}

// --------------------------------------------------------------- actions

function setPreset(key) {
  T.preset = key;
  T.counts = { ...PRESETS[key].counts };
  tDraw();
}

function setStep(i) {
  T.step = clamp(i, 0, steps().length - 1);
  tDraw();
}

// --------------------------------------------------------------- drawing

function tDraw() {
  const x = tCtx();
  for (const b of tEls.presets.children) {
    b.setAttribute("aria-checked", b.dataset.preset === T.preset);
  }
  for (const b of tEls["t-view"].children) {
    b.setAttribute("aria-checked", b.dataset.view === T.view);
  }
  const mosaic = T.view === "mosaic";
  tEls["cm-table"].hidden = mosaic;
  tEls.mosaic.style.display = mosaic ? "" : "none";
  tEls["toscale-row"].hidden = !mosaic;
  drawTable(x);
  drawMosaicTab(x);
  drawStory(x);
  drawList(x);
}

function drawTable(x) {
  const root = tEls["cm-table"], hl = tHighlight();
  for (const el of root.querySelectorAll("[data-noun]")) {
    el.textContent = x.n[el.dataset.noun];
  }
  for (const inp of root.querySelectorAll("input")) {
    if (inp !== document.activeElement) inp.value = x.c[inp.dataset.cell];
  }
  for (const el of root.querySelectorAll("[data-prop]")) {
    el.textContent = x.N ? pct(x.c[el.dataset.prop] / x.N) : "";
  }
  for (const el of root.querySelectorAll("[data-tot]")) {
    el.textContent = num(x[el.dataset.tot]);
  }
  for (const td of root.querySelectorAll("td.cm-cell")) {
    td.className = `cm-cell ${td.dataset.cell} ${
      cellState(td.dataset.cell, hl)}`;
  }
}

function drawMosaicTab(x) {
  const svg = tEls.mosaic, b = MBOX, step = steps()[T.step];
  svg.replaceChildren();
  svg.setAttribute("viewBox", "0 0 540 484");
  text("← Predict 0", { x: b.x0, y: 22, class: "axis-label" }, svg);
  text("Predict 1 →", { x: b.x1, y: 22, class: "axis-label",
    "text-anchor": "end" }, svg);
  const rows = drawMosaic(svg, x.c, b, { toScale: T.toScale,
    hl: tHighlight(), labels: true });

  // Row labels, kept apart when a row is thin.
  const ys = rows.map(r => r.y + r.h / 2);
  ys[0] = clamp(ys[0], b.y0 + 24, b.y1 - 90);
  ys[1] = clamp(Math.max(ys[1], ys[0] + 66), b.y0 + 90, b.y1 - 34);
  if (ys[1] - ys[0] < 66) ys[0] = ys[1] - 66;
  rows.forEach((r, i) => {
    const g = node("g", { class: `row-label r${i}` }, svg);
    text(`Truth ${i}`, { x: b.x0 - 12, y: ys[i] - 14, class: "rl-head" }, g);
    text(x.n[`t${i}`], { x: b.x0 - 12, y: ys[i] + 9, class: "rl-noun" }, g);
    text(`${num(r.n)} (${x.N ? pct(r.n / x.N) : "–"})`,
      { x: b.x0 - 12, y: ys[i] + 32, class: "rl-count" }, g);
  });

  // Draggable dividers: between the rows (to scale only) and in each row.
  const pulse = step.rows ? " pulse" : "";
  if (T.toScale) {
    const y = rows[1].y;
    const g = node("g", { class: `handle row${pulse}`, "data-handle": "row" },
      svg);
    node("line", { x1: b.x0 - 6, x2: b.x1 + 6, y1: y, y2: y,
      class: "h-line" }, g);
    node("line", { x1: b.x0 - 6, x2: b.x1 + 6, y1: y, y2: y,
      class: "h-hit" }, g);
    node("circle", { cx: b.x1 + 13, cy: y, r: 7, class: "h-grip" }, g);
  }
  rows.forEach((r, i) => {
    if (!r.n) return;
    const g = node("g", { class: "handle col", "data-handle": `col${i}` },
      svg);
    const y1 = r.y, y2 = r.y + r.h;
    node("line", { x1: r.split, x2: r.split, y1, y2, class: "h-line" }, g);
    node("line", { x1: r.split, x2: r.split, y1, y2, class: "h-hit" }, g);
    if (r.h > 16) {
      node("circle", { cx: r.split, cy: (y1 + y2) / 2, r: 6,
        class: "h-grip" }, g);
    }
  });
}

function drawStory(x) {
  const s = steps()[T.step];
  tEls["story-count"].textContent = `Tour ${T.step + 1} / ${steps().length}`;
  tEls["story-title"].textContent = s.title;
  tEls["story-body"].innerHTML = s.text(x);
  tEls["story-back"].disabled = T.step === 0;
  tEls["story-next"].disabled = T.step === steps().length - 1;
}

function drawList(x) {
  const active = T.hoverMetric || steps()[T.step].hl;
  const also = T.hoverMetric ? null : steps()[T.step].also;
  for (const row of tEls.mlist.querySelectorAll(".mrow")) {
    const k = row.dataset.key, m = METRIC[k];
    row.classList.toggle("on", k === active);
    row.classList.toggle("also", k === also);
    const uses = T.hoverCell && !m.avg;
    row.classList.toggle("in-num", !!uses && m.num.includes(T.hoverCell));
    row.classList.toggle("in-den", !!uses && !m.num.includes(T.hoverCell)
      && m.den.includes(T.hoverCell));
  }
  for (const el of tEls.mlist.querySelectorAll("[data-val]")) {
    el.textContent = metricText(el.dataset.val, x.m[el.dataset.val]);
  }
}

// ------------------------------------------------------------ dragging

/**
 * Dividers move samples between cells with N fixed. The row divider sets
 * the class counts and keeps each row's rates (TPR, FPR) from the start of
 * the drag; a row's own divider trades between its two cells.
 */
function buildMosaicEvents() {
  const svg = tEls.mosaic;
  svg.addEventListener("pointerdown", e => {
    const h = e.target.closest("[data-handle]");
    if (!h) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const c = T.counts, n0 = c.tn + c.fp, n1 = c.fn + c.tp;
    T.drag = { type: h.dataset.handle,
      tpr: n1 ? c.tp / n1 : 0.5, fpr: n0 ? c.fp / n0 : 0.1 };
  });
  svg.addEventListener("pointermove", e => {
    if (!T.drag) {
      const cell = e.target.dataset ? e.target.dataset.cell : null;
      if ((cell || null) !== T.hoverCell) hoverCell(cell || null);
      return;
    }
    const p = svgPoint(svg, e), b = MBOX, c = T.counts;
    const N = cellSum(c, CELLS);
    if (T.drag.type === "row") {
      const n0 = Math.round(clamp((p.y - b.y0) / (b.y1 - b.y0), 0, 1) * N);
      const n1 = N - n0;
      c.fp = Math.round(T.drag.fpr * n0);
      c.tn = n0 - c.fp;
      c.tp = Math.round(T.drag.tpr * n1);
      c.fn = n1 - c.tp;
    } else {
      const f = clamp((p.x - b.x0) / (b.x1 - b.x0), 0, 1);
      const [lft, rgt] = T.drag.type === "col0" ? ["tn", "fp"] : ["fn", "tp"];
      const n = c[lft] + c[rgt];
      c[lft] = Math.round(f * n);
      c[rgt] = n - c[lft];
    }
    tDraw();
  });
  const end = () => { T.drag = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("pointerleave", () => {
    if (!T.drag && T.hoverCell) hoverCell(null);
  });
}

function tKey(e) {
  if (e.key === "ArrowRight") setStep(T.step + 1);
  else if (e.key === "ArrowLeft") setStep(T.step - 1);
  else return false;
  return true;
}
