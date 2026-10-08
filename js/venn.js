// F1 as the Dice overlap of two sets: circle A = the true 1s, circle B =
// the predicted 1s, overlap TP, areas to scale with each other. TN is the
// space outside both, which is why F1 never uses it.

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
 * Draw the Venn diagram of counts c into svg and the Dice formula into
 * note. The center distance solves lensArea = TP by bisection (the overlap
 * shrinks as the circles move apart).
 */
function drawVenn(svg, note, c) {
  svg.replaceChildren();
  svg.setAttribute("viewBox", "0 0 360 228");
  node("rect", { x: 4, y: 4, width: 352, height: 220, rx: 10,
    class: "venn-all" }, svg);
  text(`${CELL_LABEL.tn} ${num(c.tn)}: outside both`, { x: 16, y: 214,
    class: "venn-tn" }, svg);
  const A = c.fn + c.tp, B = c.fp + c.tp, big = Math.max(A, B);
  text(`A: Truth 1 (${num(A)})`, { x: 16, y: 24, class: "venn-set a" }, svg);
  text(`B: Predict 1 (${num(B)})`, { x: 344, y: 24, class: "venn-set b",
    "text-anchor": "end" }, svg);
  if (!big) {
    note.textContent = "Both sets are empty: F1 is undefined.";
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
  const ax = 180 - (ra + d + rb) / 2 + ra, bx = ax + d, cy = 112;
  if (ra) node("circle", { cx: ax, cy, r: ra, class: "venn-a" }, svg);
  if (rb) node("circle", { cx: bx, cy, r: rb, class: "venn-b" }, svg);
  const lab = (k, lx) => text(CELL_LABEL[k], { x: lx, y: cy + 5,
    class: `cell-name ${k}` }, svg);
  if (c.tp) {
    const inside = d <= Math.abs(ra - rb) + 1e-6;
    lab("tp", inside ? (ra < rb ? ax : bx)
      : ((bx - rb) + Math.min(ax + ra, bx + rb)) / 2);
  }
  if (c.fn && ra > 12) lab("fn", ax - ra * 0.55);
  if (c.fp && rb > 12) lab("fp", bx + rb * 0.55);
  const dice = 2 * c.tp / (A + B);
  note.innerHTML = `Dice = ${fracHTML("2 · |A ∩ B|", "|A| + |B|")} =
    ${fracHTML(`2 · ${num(c.tp)}`, `${num(A)} + ${num(B)}`)} =
    <b>${metricText("f1", dice)}</b> = F1. The circles are to scale with
    each other; the box (everyone) is not.`;
}
