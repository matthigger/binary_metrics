// Confusion matrix tab: an editable 2 x 2 table of counts, the same counts
// as a mosaic with draggable dividers, a guided tour that highlights each
// metric's numerator (filled) and denominator (outlined), a list of every
// metric, and a Venn diagram showing F1 as the Dice overlap of two sets.

const PRESETS = {
  strep: {
    name: "Strep test",
    // 37% prevalence; sensitivity 86%, specificity 95%.
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
      + "prevalence 1%, sensitivity 90%, false alarm rate 9% "
      + "(Gigerenzer et al. 2007).",
  },
  lazy: {
    name: "Always say no",
    counts: { tn: 990, fp: 0, fn: 10, tp: 0 },
    nouns: { pop: "women screened", pos: "women with breast cancer",
      neg: "women without breast cancer", has1: "have breast cancer",
      has0: "don't have breast cancer",
      test: "a test that always says negative", t0: "No cancer",
      t1: "Cancer", p0: "Negative", p1: "Positive" },
    source: "The same 1,000 women as Mammogram, \"tested\" by always "
      + "answering negative. Compare its accuracy with the mammogram's.",
  },
};

// Tour steps: hl is the metric highlighted, also a second metric sharing
// its denominator; text(x) is the step's HTML from the context x.
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
  { title: "Prevalence", hl: "prev", text: x => `
    <p>How common is the condition, before any test? ${num(x.n1)} of the
      ${num(x.N)} ${x.n.has1}.</p>
    ${formulaHTML("prev", x.c)}
    <p class="muted">Prevalence describes the population, not the test.
      Still, several metrics below depend on it.</p>` },
  { title: "Accuracy", hl: "acc", text: x => `
    <p>How often is ${x.n.test} right? It is right for the cells on the
      diagonal.</p>
    ${formulaHTML("acc", x.c)}
    <p class="muted">Careful when the condition is rare: a test that
      always says negative is right for everyone without it, an accuracy
      of 1 &minus; prevalence = ${pct(1 - x.m.prev)}.</p>` },
  { title: "Out of the Truth 1 row", hl: "tpr", also: "fnr", text: x => `
    <p>Of the ${num(x.n1)} ${x.n.pos}, ${x.n.test} catches
      ${num(x.c.tp)}:</p>
    ${formulaHTML("tpr", x.c)}
    <p>and misses ${num(x.c.fn)}:</p>
    ${formulaHTML("fnr", x.c)}
    <p class="muted">The two add to 100%. Both use only the Truth 1 row:
      they say nothing about the ${x.n.neg}.</p>` },
  { title: "Out of the Truth 0 row", hl: "tnr", also: "fpr", text: x => `
    <p>Of the ${num(x.n0)} ${x.n.neg}, ${x.n.test} correctly clears
      ${num(x.c.tn)}:</p>
    ${formulaHTML("tnr", x.c)}
    <p>and raises a false alarm for ${num(x.c.fp)}:</p>
    ${formulaHTML("fpr", x.c)}
    <p class="muted">FPR = 1 &minus; TNR. The ROC curve (next tab) plots
      TPR against FPR.</p>` },
  { title: "Out of the Predict 1 column", hl: "ppv", also: "fdr",
    text: x => `
    <p>${cap(x.n.test)} says positive for ${num(x.pp)}. How many of them
      really ${x.n.has1}? ${num(x.c.tp)}:</p>
    ${formulaHTML("ppv", x.c)}
    <p>The other ${num(x.c.fp)} are false alarms:</p>
    ${formulaHTML("fdr", x.c)}
    <p class="muted">Precision answers the question asked after a
      positive result: should I believe it?</p>` },
  { title: "Out of the Predict 0 column", hl: "npv", also: "for",
    text: x => `
    <p>${cap(x.n.test)} says negative for ${num(x.pn)}. How many of them
      really ${x.n.has0}? ${num(x.c.tn)}:</p>
    ${formulaHTML("npv", x.c)}
    <p>The other ${num(x.c.fn)} are missed:</p>
    ${formulaHTML("for", x.c)}` },
  { title: "Rows describe the test; columns depend on prevalence",
    hl: null, rows: true, text: x => `
    <p>The row ratios use one true class each, so they describe the test
      itself. The column ratios mix both rows, so they also depend on how
      common the condition is.</p>
    <p><b>Drag the line between the rows</b>${T.toScale ? ""
      : " (turn on Rows to scale first)"}: prevalence changes, the row
      ratios stay put and the column ratios move.</p>
    <div class="compare">
      <div><h4>Rows</h4>
        <div>TPR <b>${pct(x.m.tpr)}</b></div>
        <div>FPR <b>${pct(x.m.fpr)}</b></div></div>
      <div><h4>Columns</h4>
        <div>Precision <b>${pct(x.m.ppv)}</b></div>
        <div>NPV <b>${pct(x.m.npv)}</b></div></div>
      <div><h4>Neither</h4>
        <div>Prevalence <b>${pct(x.m.prev)}</b></div>
        <div>Accuracy <b>${pct(x.m.acc)}</b></div></div>
    </div>` },
  { title: "F1 score (Dice)", hl: "f1", venn: true, text: x => `
    <p>One number that rewards both catching the ${x.n.pos} (recall) and
      being right when flagging them (precision): their harmonic
      mean.</p>
    ${formulaHTML("f1", x.c)}
    <div class="formula">F1 = ${fracHTML("2 · precision · recall",
      "precision + recall")} = ${fracHTML(
      `2 · ${pct(x.m.ppv)} · ${pct(x.m.tpr)}`,
      `${pct(x.m.ppv)} + ${pct(x.m.tpr)}`)}</div>
    <p class="muted">${chip("tn")} appears nowhere, so piling on true
      negatives cannot change F1. Read as sets (the Venn diagram below),
      the same formula is the Dice coefficient.</p>` },
  { title: "Balanced accuracy", hl: "bacc", text: x => `
    <p>The average of the two row ratios that count correct
      predictions:</p>
    ${formulaHTML("bacc", x.c)}
    <p class="muted">Each true class counts equally however rare it is,
      so a test that always says negative scores 50% (TPR 0%, TNR
      100%).</p>` },
];

const MBOX = { x0: 160, x1: 616, y0: 34, y1: 452 };

const T = {
  preset: "strep",
  counts: null,
  step: 0,
  // Metric key under the pointer in the list, or the hovered cell.
  hoverMetric: null,
  hoverCell: null,
  toScale: true,
  drag: null,
};

const tEls = {};

function cap(s) { return s[0].toUpperCase() + s.slice(1); }

function nouns() { return PRESETS[T.preset].nouns; }

function tCtx() {
  const c = T.counts;
  return { c, n: nouns(), m: allMetrics(c), N: cellSum(c, CELLS),
    n0: c.tn + c.fp, n1: c.fn + c.tp, pp: c.fp + c.tp, pn: c.tn + c.fn };
}

function stepOf(key) {
  return STEPS.findIndex(s => s.hl === key || s.also === key);
}

/** Highlight in force: hovered cell, else hovered metric, else the step. */
function tHighlight() {
  if (T.hoverCell) return { num: [T.hoverCell], den: [] };
  if (T.hoverMetric) return highlightOf(T.hoverMetric);
  return highlightOf(STEPS[T.step].hl);
}

// ------------------------------------------------------------------ build

function tBuild() {
  for (const id of ["presets", "toscale", "treset", "cm-table", "mosaic",
    "story-count", "story-title", "story-body", "story-back",
    "story-next", "mlist", "venn", "venn-note", "venn-card", "t-source"]) {
    tEls[id] = document.getElementById(id);
  }
  for (const [key, p] of Object.entries(PRESETS)) {
    const b = document.createElement("button");
    b.textContent = p.name;
    b.dataset.preset = key;
    b.setAttribute("role", "radio");
    b.onclick = () => setPreset(key);
    tEls.presets.append(b);
  }
  tEls.toscale.onchange = () => {
    T.toScale = tEls.toscale.checked;
    tDraw();
  };
  tEls.treset.onclick = () => setPreset(T.preset);
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
  for (const g of GROUPS) {
    html += `<h4>${g.title}</h4>`;
    for (const m of METRICS.filter(m => m.group === g.key)) {
      html += `<div class="mrow" data-key="${m.key}">
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
  T.step = clamp(i, 0, STEPS.length - 1);
  tDraw();
}

// --------------------------------------------------------------- drawing

function tDraw() {
  const x = tCtx();
  for (const b of tEls.presets.children) {
    b.setAttribute("aria-checked", b.dataset.preset === T.preset);
  }
  tEls["t-source"].textContent = PRESETS[T.preset].source;
  drawTable(x);
  drawMosaicTab(x);
  drawStory(x);
  drawList(x);
  drawVenn(x);
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
  const svg = tEls.mosaic, b = MBOX, step = STEPS[T.step];
  svg.replaceChildren();
  svg.setAttribute("viewBox", "0 0 640 470");
  text("← Predict 0", { x: b.x0, y: 22, class: "axis-label" }, svg);
  text("Predict 1 →", { x: b.x1, y: 22, class: "axis-label",
    "text-anchor": "end" }, svg);
  const rows = drawMosaic(svg, x.c, b, { toScale: T.toScale,
    hl: tHighlight(), labels: true });

  // Row labels, kept apart when a row is thin.
  const ys = rows.map(r => r.y + r.h / 2);
  ys[0] = clamp(ys[0], b.y0 + 22, b.y1 - 70);
  ys[1] = clamp(Math.max(ys[1], ys[0] + 48), b.y0 + 70, b.y1 - 22);
  if (ys[1] - ys[0] < 48) ys[0] = ys[1] - 48;
  rows.forEach((r, i) => {
    const g = node("g", { class: `row-label r${i}` }, svg);
    text(`Truth ${i}`, { x: b.x0 - 12, y: ys[i] - 10, class: "rl-head" }, g);
    text(x.n[`t${i}`], { x: b.x0 - 12, y: ys[i] + 7, class: "rl-noun" }, g);
    text(`${num(r.n)} (${x.N ? pct(r.n / x.N) : "–"})`,
      { x: b.x0 - 12, y: ys[i] + 24, class: "rl-count" }, g);
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
  const s = STEPS[T.step];
  tEls["story-count"].textContent = `Tour ${T.step + 1} / ${STEPS.length}`;
  tEls["story-title"].textContent = s.title;
  tEls["story-body"].innerHTML = s.text(x);
  tEls["story-back"].disabled = T.step === 0;
  tEls["story-next"].disabled = T.step === STEPS.length - 1;
  tEls["venn-card"].classList.toggle("active", !!s.venn);
}

function drawList(x) {
  const active = T.hoverMetric || STEPS[T.step].hl;
  const also = T.hoverMetric ? null : STEPS[T.step].also;
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

// ------------------------------------------------------------------- Venn

/** Area of the overlap of circles of radii r1, r2 with centers d apart. */
function lensArea(d, r1, r2) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const b = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const k = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2)
    * (d + r1 + r2));
  return a + b - k;
}

/**
 * Circle A = the true 1s, circle B = the predicted 1s, overlap TP, areas
 * to scale with each other. The center distance solves lensArea = TP by
 * bisection (the overlap shrinks as the circles move apart).
 */
function drawVenn(x) {
  const svg = tEls.venn, c = x.c;
  svg.replaceChildren();
  svg.setAttribute("viewBox", "0 0 360 228");
  node("rect", { x: 4, y: 4, width: 352, height: 220, rx: 10,
    class: "venn-all" }, svg);
  text(`${CELL_LABEL.tn} ${num(c.tn)}: outside both`, { x: 16, y: 214,
    class: "venn-tn" }, svg);
  const A = c.fn + c.tp, B = c.fp + c.tp, big = Math.max(A, B);
  if (!big) {
    tEls["venn-note"].textContent = "Both sets are empty: F1 is undefined.";
    return;
  }
  const R = 70, scale = Math.PI * R * R / big;
  const ra = Math.sqrt(A * scale / Math.PI);
  const rb = Math.sqrt(B * scale / Math.PI);
  let lo = Math.abs(ra - rb), hi = ra + rb;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (lensArea(mid, ra, rb) > c.tp * scale) lo = mid;
    else hi = mid;
  }
  const d = c.tp ? (lo + hi) / 2 : ra + rb + 8;
  const ax = 180 - (ra + d + rb) / 2 + ra, bx = ax + d, cy = 108;
  if (ra) node("circle", { cx: ax, cy, r: ra, class: "venn-a" }, svg);
  if (rb) node("circle", { cx: bx, cy, r: rb, class: "venn-b" }, svg);
  text(`A: Truth 1 (${num(A)})`, { x: 16, y: 24, class: "venn-set a" },
    svg);
  text(`B: Predict 1 (${num(B)})`, { x: 344, y: 24, class: "venn-set b",
    "text-anchor": "end" }, svg);
  const lab = (k, lx) => text(CELL_LABEL[k], { x: lx, y: cy + 5,
    class: `cell-name ${k}` }, svg);
  if (c.tp) {
    const inside = d <= Math.abs(ra - rb) + 1e-6;
    lab("tp", inside ? (ra < rb ? ax : bx)
      : ((bx - rb) + Math.min(ax + ra, bx + rb)) / 2);
  }
  if (c.fn && ra > 12) lab("fn", ax - ra * 0.55);
  if (c.fp && rb > 12) lab("fp", bx + rb * 0.55);
  const dice = (A + B) ? 2 * c.tp / (A + B) : NaN;
  tEls["venn-note"].innerHTML = `Dice = ${fracHTML("2 · |A ∩ B|",
    "|A| + |B|")} = ${fracHTML(`2 · ${num(c.tp)}`,
    `${num(A)} + ${num(B)}`)} = <b>${metricText("f1", dice)}</b> = F1.
    The circles are to scale with each other; the box (everyone) is not.`;
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
