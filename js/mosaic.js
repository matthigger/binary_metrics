// The confusion matrix drawn as a mosaic, shared by the Confusion matrix tab
// (large, labeled, draggable) and the Would you rather tab (small). Each
// row is one true class, its height proportional to the class count when
// to scale; the row splits at the prediction, so a cell's width within its
// row is that row's rate (TN | FP is TNR | FPR, FN | TP is FNR | TPR).
// Correct cells are solid, wrong ones hatched.

/** Numerator and denominator cells of a metric key, or null for none. */
function highlightOf(key) {
  if (!key) return null;
  const m = METRIC[key];
  if (m.avg) return { num: ["tn", "tp"], den: CELLS };
  return { num: m.num, den: m.den };
}

/** Highlight class of cell k: "num", "den", "dim" or "" (no highlight). */
function cellState(k, hl) {
  if (!hl) return "";
  if (hl.num.includes(k)) return "num";
  if (hl.den.includes(k)) return "den";
  return "dim";
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
 * Append the mosaic to parent: cells, then outlines of the highlighted
 * cells on top so neighbors cannot cover them, then labels when there is
 * room (opt.labels). Returns the layout.
 */
function drawMosaic(parent, c, b, opt = {}) {
  const rows = mosaicLayout(c, b, opt.toScale !== false);
  const cells = node("g", {}, parent);
  const lines = node("g", { class: "outlines" }, parent);
  const labels = node("g", {}, parent);
  for (const row of rows) {
    row.cells.forEach((k, j) => {
      const x = j ? row.split : b.x0;
      const w = Math.max(0, j ? b.x1 - row.split : row.split - b.x0);
      const st = cellState(k, opt.hl);
      node("rect", { x, y: row.y, width: w, height: Math.max(0, row.h),
        class: `cell ${k} ${st}`, "data-cell": k }, cells);
      if (st === "num" || st === "den") {
        node("rect", { x, y: row.y, width: w, height: Math.max(0, row.h),
          class: `outline ${st}` }, lines);
      }
      if (!opt.labels || w < 30 || row.h < 18) return;
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
