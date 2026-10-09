// Hover to explain in plain English. An element with data-tip shows that
// text as is. One with data-explain (a metric key, a cell key, "auc" or
// "flag") or data-cell gets a tooltip sentence; the nearest ancestor's data-ctx names the context, a function
// in EXPLAIN returning { c?, n, who, auc? }: the counts (absent for a
// generic definition), the nouns { pop, pos, neg, has1, has0 } and the
// classifier's name.

const EXPLAIN = {};

/**
 * Natural frequency "k of every base": per 100, or per 1,000 (10,000)
 * when that hides a rate near 0% or 100%.
 */
function freq(v) {
  const p = 100 * v;
  if ((p > 0 && p < 9.5) || (p > 99 && p < 100)) {
    const k = Math.round(1000 * v), m = Math.min(k, 1000 - k);
    if (m < 10) return { k: num(Math.round(1e4 * v)), base: "10,000" };
    return { k: num(k), base: "1,000" };
  }
  return { k: num(Math.round(p)), base: "100" };
}

/** Plain-English sentence for key in context x, or "" if none. */
function explainText(key, x) {
  const { c, n } = x, who = x.who, Who = cap(who);
  const has1 = n.has1 || `are ${n.pos}`, has0 = n.has0 || `are ${n.neg}`;
  if (!c) return GENERIC[key] ? GENERIC[key](n, who) : "";
  const v = key === "auc" ? x.auc : METRIC[key] ? metricValue(key, c) : 0;
  if (METRIC[key] && !Number.isFinite(v)) {
    return `Undefined here: its denominator is 0.`;
  }
  const f = freq(v);
  const S = {
    tn: () => `True negative (TN): ${who} says negative and is right. `
      + `${num(c.tn)} ${n.neg}.`,
    fp: () => `False positive (FP): ${who} says positive but is wrong, a `
      + `false alarm. ${num(c.fp)} ${n.neg}.`,
    fn: () => `False negative (FN): ${who} says negative but is wrong, a `
      + `miss. ${num(c.fn)} ${n.pos}.`,
    tp: () => `True positive (TP): ${who} says positive and is right. `
      + `${num(c.tp)} ${n.pos}.`,
    flag: () => `${Who} flags ${num(c.tp + c.fp)} of the `
      + `${num(cellSum(c, CELLS))} ${n.pop} as positive, right or wrong.`,
    acc: () => `${Who} is right about ${f.k} of every ${f.base} ${n.pop}.`,
    prev: () => `${f.k} of every ${f.base} ${n.pop} ${has1}, before any `
      + "test.",
    tpr: () => `Of every ${f.base} ${n.pos}, ${who} catches about ${f.k}.`,
    fnr: () => `Of every ${f.base} ${n.pos}, ${who} misses about ${f.k}.`,
    tnr: () => `Of every ${f.base} ${n.neg}, ${who} correctly clears about `
      + `${f.k}.`,
    fpr: () => `Of every ${f.base} ${n.neg}, ${who} wrongly flags about `
      + `${f.k}: false alarms.`,
    ppv: () => `Of every ${f.base} that ${who} flags as positive, about `
      + `${f.k} really ${has1}.`,
    fdr: () => `Of every ${f.base} that ${who} flags as positive, about `
      + `${f.k} are false alarms.`,
    npv: () => `Of every ${f.base} that ${who} clears as negative, about `
      + `${f.k} really ${has0}.`,
    for: () => `Of every ${f.base} that ${who} clears as negative, about `
      + `${f.k} are misses: they ${has1}.`,
    bacc: () => `The average of TPR (${pct(metricValue("tpr", c))}) and TNR `
      + `(${pct(metricValue("tnr", c))}): how often ${who} is right on each `
      + "class, each counting equally however rare.",
    auc: () => `Area under the curve (AUC): pick one `
      + `${n.pos.replace(/s$/, "")} and one `
      + `${n.neg.replace(/s$/, "")} at random: ${pct(v)} of the time the `
      + `first gets the higher score.`,
  };
  return S[key] ? S[key]() : "";
}

// Definitions without numbers, for the cheat sheet.
const GENERIC = {
  acc: n => `The share of all ${n.pop} it gets right.`,
  prev: n => `The share of all ${n.pop} that are ${n.pos}: the population, `
    + "not the classifier.",
  tpr: n => `Of the ${n.pos}, the share it catches.`,
  fnr: n => `Of the ${n.pos}, the share it misses.`,
  tnr: n => `Of the ${n.neg}, the share it correctly clears.`,
  fpr: n => `Of the ${n.neg}, the share it wrongly flags: false alarms.`,
  ppv: n => `Of everything it flags, the share that really are ${n.pos}.`,
  fdr: () => "Of everything it flags, the share that are false alarms.",
  npv: n => `Of everything it clears, the share that really are ${n.neg}.`,
  for: n => `Of everything it clears, the share that are missed ${n.pos}.`,
  bacc: () => "The average of TPR and TNR: each class counts equally.",
};

(function () {
  const tip = document.createElement("div");
  tip.id = "tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.append(tip);
  let cur = null;

  function place(e) {
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 18;
    if (x + w > innerWidth - 8) x = Math.max(8, e.clientX - w - 14);
    if (y + h > innerHeight - 8) y = Math.max(8, e.clientY - h - 14);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  document.addEventListener("pointerover", e => {
    const el = e.target.closest ? e.target.closest("[data-tip], "
      + "[data-explain], [data-cell]") : null;
    const host = el && el.closest("[data-ctx]");
    let s = el && el.dataset.tip;
    if (!s && host && EXPLAIN[host.dataset.ctx]) {
      s = explainText(el.dataset.explain || el.dataset.cell,
        EXPLAIN[host.dataset.ctx]());
    }
    cur = s ? el : null;
    tip.hidden = !s;
    if (s) {
      tip.textContent = s;
      place(e);
    }
  });
  document.addEventListener("pointermove", e => {
    if (cur && !tip.hidden) place(e);
  });
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") tip.hidden = true;
  });
})();
