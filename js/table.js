// The metrics tab: an editable 2 x 2 table of counts, the same counts
// as a mosaic with draggable dividers, and a list of the metrics. Resting
// on a metric darkens its numerator within its denominator and dims the
// rest. "Just the popular ones" (SETTINGS.popular) trims the list.

const PRESETS = {
  coin: {
    name: "Coin flip",
    counts: { tn: 250, fp: 250, fn: 250, tp: 250 },
    nouns: { pop: "all coin tosses", pos: "heads", neg: "tails",
      has1: "land heads", has0: "land tails", test: "the guess",
      t0: "Tails", t1: "Heads", p0: "Guess tails", p1: "Guess heads" },
    source: "Guessing 1,000 tosses of a fair coin, heads (class 1) or "
      + "tails (class 0), by flipping a second coin. The guess is right "
      + "half the time: chance accuracy.",
  },
  heart: {
    name: "Heart test",
    // 40% prior; sensitivity 68%, specificity 77%.
    counts: { tn: 462, fp: 138, fn: 128, tp: 272 },
    nouns: { pop: "everyone",
      pos: "patients with heart disease",
      neg: "patients without heart disease", has1: "have heart disease",
      has0: "don't have heart disease", test: "the heart test",
      t0: "No disease", t1: "Disease", p0: "Test negative",
      p1: "Test positive" },
    source: "A treadmill heart test (an ECG while exercising) for "
      + "blocked heart arteries, on 1,000 patients, 40% of whom have "
      + "the disease (for illustration). The test has sensitivity "
      + "68% and specificity 77% (Gianrossi et al. 1989).",
  },
  strep: {
    name: "Strep test",
    // 37% prior; sensitivity 86%, specificity 95%.
    counts: { tn: 601, fp: 29, fn: 52, tp: 318 },
    nouns: { pop: "everyone", pos: "children with strep",
      neg: "children without strep", has1: "have strep",
      has0: "don't have strep", test: "the rapid strep test",
      t0: "No strep", t1: "Strep", p0: "Test negative",
      p1: "Test positive" },
    source: "A rapid strep test on 1,000 children. Rates from published "
      + "reviews: a 37% prior (Shaikh et al. 2010); the rapid test has "
      + "sensitivity 86% and specificity 95% (Cohen et al. 2016).",
  },
  mammo: {
    name: "Mammogram",
    counts: { tn: 901, fp: 89, fn: 1, tp: 9 },
    nouns: { pop: "everyone", pos: "women with breast cancer",
      neg: "women without breast cancer", has1: "have breast cancer",
      has0: "don't have breast cancer", test: "the mammogram",
      t0: "No cancer", t1: "Cancer", p0: "Test negative",
      p1: "Test positive" },
    source: "A mammogram on 1,000 women, with the classic teaching numbers: "
      + "prior 1%, sensitivity 90%, false alarm rate 9% "
      + "(Gigerenzer et al. 2007).",
  },
};

const MBOX = { x0: 124, x1: 512, y0: 58, y1: 490 };

const T = {
  preset: "heart",
  counts: null,
  // Metric key under the pointer in the list, or the hovered cell.
  hoverMetric: null,
  hoverCell: null,
  toScale: true,
  // Which picture of the counts the box shows: "table" or "mosaic".
  view: "mosaic",
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

/** Highlight in force: the hovered cell, else the hovered metric. */
function tHighlight() {
  if (T.hoverCell) return { num: [T.hoverCell], den: [] };
  // A metric shows its fraction in greys: numerator dark, the rest of the
  // denominator light.
  const h = highlightOf(T.hoverMetric);
  return h && { ...h, grey: true };
}

// ------------------------------------------------------------------ build

function tBuild() {
  for (const id of ["presets", "toscale", "cm-table", "mosaic", "mlist",
    "t-view", "toscale-row"]) {
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
      <th class="cl e0">Predict 0<span class="noun" data-noun="p0"></span></th>
      <th class="cl e1">Predict 1<span class="noun" data-noun="p1"></span></th>
      <th class="tot">Total</th></tr></thead>
    <tbody>
      <tr><th class="rl t0">Truth 0<span class="noun" data-noun="t0"></span>
        </th>
        ${cell("tn")}${cell("fp")}<td class="tot" data-tot="n0"></td></tr>
      <tr><th class="rl t1">Truth 1<span class="noun" data-noun="t1"></span>
        </th>
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
    inp.onblur = () => { inp.value = Math.round(T.counts[inp.dataset.cell]); };
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
  }
}

/** Apply the "Just the popular ones" toggle. */
function tPopular() {
  buildList();
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
  drawList(x);
}

function drawTable(x) {
  const root = tEls["cm-table"], hl = tHighlight();
  for (const el of root.querySelectorAll("[data-noun]")) {
    el.textContent = x.n[el.dataset.noun];
  }
  for (const inp of root.querySelectorAll("input")) {
    if (inp !== document.activeElement) {
      inp.value = Math.round(x.c[inp.dataset.cell]);
    }
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
  root.classList.toggle("plain", !!(hl && hl.grey));
  tableFrame(root, hl);
}

/**
 * Frame a grey highlight's denominator on the table: a row, a column or
 * the whole table, so always one rectangle around its cells.
 */
function tableFrame(root, hl) {
  root.querySelector(".den-frame")?.remove();
  if (!hl || !hl.grey) return;
  const tds = hl.den.map(k => root.querySelector(`td[data-cell="${k}"]`));
  const rs = tds.map(td => td.getBoundingClientRect()), B =
    root.getBoundingClientRect();
  if (!rs.length || !rs[0].width) return;
  const pad = 4, x0 = Math.min(...rs.map(r => r.left)) - B.left - pad;
  const y0 = Math.min(...rs.map(r => r.top)) - B.top - pad;
  const f = document.createElement("div");
  f.className = "den-frame";
  Object.assign(f.style, { left: `${x0}px`, top: `${y0}px`,
    width: `${Math.max(...rs.map(r => r.right)) - B.left + pad - x0}px`,
    height: `${Math.max(...rs.map(r => r.bottom)) - B.top + pad - y0}px` });
  root.append(f);
}

function drawMosaicTab(x) {
  const svg = tEls.mosaic, b = MBOX, hl = tHighlight();
  // A metric's highlight strips the picture to its fraction: plain labels,
  // no dividers to drag.
  const plain = hl && hl.grey ? " plain" : "";
  svg.replaceChildren();
  svg.setAttribute("viewBox", "0 0 540 508");
  // Column labels at the left and right ends, since each row splits at
  // its own place.
  const cw = 156;
  [b.x0 + 2, b.x1 - 2 - cw].forEach((x0, i) => {
    const g = node("g", { class: "col-label" }, svg);
    node("rect", { x: x0, y: 2, width: cw, height: 50, rx: 8,
      class: `cl-box e${i}${plain}` }, g);
    text(i ? "Predict 1 →" : "← Predict 0",
      { x: x0 + cw / 2, y: 24, class: "rl-head" }, g);
    text(x.n[`p${i}`], { x: x0 + cw / 2, y: 45, class: "rl-noun" }, g);
  });
  const rows = drawMosaic(svg, x.c, b, { toScale: T.toScale, hl,
    labels: true, gap: 7, edge: 5.5 });

  // Row labels, kept apart when a row is thin.
  const ys = rows.map(r => r.y + r.h / 2), d = 92;
  ys[0] = clamp(ys[0], b.y0 + 44, b.y1 - 44 - d);
  ys[1] = clamp(Math.max(ys[1], ys[0] + d), b.y0 + 44 + d, b.y1 - 44);
  if (ys[1] - ys[0] < d) ys[0] = ys[1] - d;
  rows.forEach((r, i) => {
    const g = node("g", { class: "row-label" }, svg), cx = (b.x0 - 4) / 2;
    node("rect", { x: 2, y: ys[i] - 43, width: b.x0 - 8, height: 86, rx: 8,
      class: `rl-box t${i}${plain}` }, g);
    text(`Truth ${i}`, { x: cx, y: ys[i] - 16, class: "rl-head" }, g);
    text(x.n[`t${i}`], { x: cx, y: ys[i] + 7, class: "rl-noun" }, g);
    text(`${num(r.n)} (${x.N ? pct(r.n / x.N) : "–"})`,
      { x: cx, y: ys[i] + 29, class: "rl-count" }, g);
  });

  // Draggable dividers: between the rows (to scale only) and in each row.
  if (plain) return;
  if (T.toScale) {
    const y = rows[1].y;
    const g = node("g", { class: "handle row", "data-handle": "row" }, svg);
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

function drawList(x) {
  for (const row of tEls.mlist.querySelectorAll(".mrow")) {
    const k = row.dataset.key, m = METRIC[k];
    row.classList.toggle("on", k === T.hoverMetric);
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
 * the drag exactly: its cells hold expected counts, unrounded, so the row
 * ratios cannot wobble; counts are rounded only for display. A row's own
 * divider trades whole samples between its two cells.
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
    const N = Math.round(cellSum(c, CELLS));
    if (T.drag.type === "row") {
      const n0 = Math.round(clamp((p.y - b.y0) / (b.y1 - b.y0), 0, 1) * N);
      const n1 = N - n0;
      c.fp = T.drag.fpr * n0;
      c.tn = n0 - c.fp;
      c.tp = T.drag.tpr * n1;
      c.fn = n1 - c.tp;
    } else {
      const f = clamp((p.x - b.x0) / (b.x1 - b.x0), 0, 1);
      const [lft, rgt] = T.drag.type === "col0" ? ["tn", "fp"] : ["fn", "tp"];
      const n = Math.round(c[lft] + c[rgt]);
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
