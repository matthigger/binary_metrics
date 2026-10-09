// The confusion matrix drawn as a mosaic, shared by The metrics tab
// (large, labeled, draggable) and the Test yourself tab (small). Each
// row is one true class, its height proportional to the class count when
// to scale; the row splits at the prediction, so a cell's width within its
// row is that row's rate (TN | FP is TNR | FPR, FN | TP is FNR | TPR).
// Each cell is a rounded box: fill = true class, border = estimated class,
// so a wrong cell is one whose border and fill disagree.

/** Numerator and denominator cells of a metric key, or null for none. */
function highlightOf(key) {
  if (!key) return null;
  const m = METRIC[key];
  if (m.avg) return { num: ["tn", "tp"], den: CELLS };
  return { num: m.num, den: m.den };
}

/**
 * Highlight class of cell k: "num", "den", "dim" or "" (no highlight),
 * plus "grey" when hl.grey asks for numerator and denominator in greys.
 */
function cellState(k, hl) {
  if (!hl) return "";
  const g = hl.grey ? " grey" : "";
  if (hl.num.includes(k)) return "num" + g;
  if (hl.den.includes(k)) return "den" + g;
  return "dim" + g;
}

/**
 * Lay out the mosaic of counts c in box b = { x0, x1, y0, y1 }.
 *
 * Returns rows (Truth 0, Truth 1): { cells, n, y, h, split }, split being
 * the x of the boundary between the Predict 0 and Predict 1 cells.
 */
function mosaicLayout(c, b, toScale) {
  const n = [c.tn + c.fp, c.fn + c.tp], N = n[0] + n[1];
  const H = b.y1 - b.y0, W = b.x1 - b.x0;
  const h0 = toScale && N ? H * n[0] / N : H / 2;
  return [["tn", "fp"], ["fn", "tp"]].map((cells, r) => ({
    cells,
    n: n[r],
    y: r ? b.y0 + h0 : b.y0,
    h: r ? H - h0 : h0,
    split: b.x0 + W * (n[r] ? c[cells[0]] / n[r] : 0.5),
  }));
}

/**
 * Append the mosaic to parent: cells, then labels when there is room
 * (opt.labels). A highlight (opt.hl) darkens the numerator cells and
 * dims every cell outside the denominator. opt.gap is the white space
 * between cells and opt.edge the border width, in viewBox units. Returns
 * the layout.
 */
function drawMosaic(parent, c, b, opt = {}) {
  const rows = mosaicLayout(c, b, opt.toScale !== false);
  const cells = node("g", {}, parent);
  const labels = node("g", {}, parent);
  const g = opt.gap ?? 4, e = opt.edge ?? 3;
  for (const row of rows) {
    row.cells.forEach((k, j) => {
      const x = j ? row.split : b.x0;
      const w = Math.max(0, j ? b.x1 - row.split : row.split - b.x0);
      const st = cellState(k, opt.hl);
      // The box fills its slot less half the gap on each side; the stroke
      // straddles the box edge, so inset it by half the border too.
      const bw = w - g - e, bh = row.h - g - e;
      if (bw > 0 && bh > 0) {
        node("rect", { x: x + (g + e) / 2, y: row.y + (g + e) / 2,
          width: bw, height: bh, rx: Math.min(6, bw / 2, bh / 2),
          "stroke-width": e, class: `cell ${k} ${st}`, "data-cell": k },
          cells);
      } else if (w > 0 && row.h > 0) {
        // Too thin for a border: a sliver in the estimate's color, at
        // least 2 units across so a rare class never vanishes.
        const sw = w > g + 2 ? w - g : Math.min(w, 2);
        const sh = row.h > g + 2 ? row.h - g : Math.min(row.h, 2);
        node("rect", { x: x + (w - sw) / 2, y: row.y + (row.h - sh) / 2,
          width: sw, height: sh, class: `cell sliver ${k} ${st}`,
          "data-cell": k }, cells);
      }
      if (!opt.labels || bw < 36 || bh < 18) return;
      const cx = x + w / 2, cy = row.y + row.h / 2;
      const two = row.h >= 50 && w >= 44;
      text(CELL_LABEL[k], { x: cx, y: two ? cy - 6 : cy + 6,
        class: `cell-name ${k} ${st}` }, labels);
      if (two) {
        text(num(c[k]), { x: cx, y: cy + 20, class: `cell-count ${st}` },
          labels);
      }
    });
  }
  return rows;
}

// Truth (row) and estimate (column) of each cell.
const CELL_TE = { tn: [0, 0], fp: [0, 1], fn: [1, 0], tp: [1, 1] };

/**
 * Append an SVG chip for cell k at (x, y), styled like the cells: the
 * label s on the true class's fill inside the estimate's border. anchor
 * is "start" or "end", the side of x the chip grows from.
 */
function svgChip(parent, k, s, x, y, anchor = "start") {
  const [t, e] = CELL_TE[k], w = 9 * s.length + 10, h = 22;
  const x0 = anchor === "end" ? x - w : x;
  const g = node("g", { class: "svg-chip" }, parent);
  node("rect", { x: x0, y: y - h / 2, width: w, height: h, rx: 5,
    class: `chip-bg t${t} e${e}` }, g);
  text(s, { x: x0 + w / 2, y: y + 5, class: "cell-name" }, g);
  return g;
}
