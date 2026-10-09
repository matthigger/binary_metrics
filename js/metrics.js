// The 2 x 2 confusion matrix and every metric built from it. Rows are the
// truth, columns the prediction, class 0 first, as in the course notes:
//
//              Predict 0   Predict 1
//   Truth 0       TN          FP
//   Truth 1       FN          TP
//
// Counts are an object { tn, fp, fn, tp }. Each ratio metric divides the
// sum of its num cells by the sum of its den cells.

const CELLS = ["tn", "fp", "fn", "tp"];
const CELL_LABEL = { tn: "TN", fp: "FP", fn: "FN", tp: "TP" };

const GROUPS = [
  { key: "all", title: "Out of everyone" },
  { key: "t1", title: "Out of the Truth 1 row" },
  { key: "t0", title: "Out of the Truth 0 row" },
  { key: "p1", title: "Out of the Predict 1 column" },
  { key: "p0", title: "Out of the Predict 0 column" },
  { key: "avg", title: "Average of the rows" },
];

const METRICS = [
  { key: "acc", group: "all", name: "Accuracy", aka: "",
    num: ["tn", "tp"], den: CELLS },
  { key: "prev", group: "all", name: "Prior", aka: "prevalence, base rate",
    num: ["fn", "tp"], den: CELLS },
  { key: "tpr", group: "t1", name: "TPR", aka: "recall, sensitivity",
    num: ["tp"], den: ["fn", "tp"] },
  { key: "fnr", group: "t1", name: "FNR", aka: "miss rate",
    num: ["fn"], den: ["fn", "tp"] },
  { key: "tnr", group: "t0", name: "TNR", aka: "specificity",
    num: ["tn"], den: ["tn", "fp"] },
  { key: "fpr", group: "t0", name: "FPR", aka: "false alarm rate",
    num: ["fp"], den: ["tn", "fp"] },
  { key: "ppv", group: "p1", name: "Precision", aka: "PPV",
    num: ["tp"], den: ["fp", "tp"] },
  { key: "fdr", group: "p1", name: "FDR", aka: "false discovery rate",
    num: ["fp"], den: ["fp", "tp"] },
  { key: "npv", group: "p0", name: "NPV",
    aka: "negative predictive value", num: ["tn"], den: ["tn", "fn"] },
  { key: "for", group: "p0", name: "FOR", aka: "false omission rate",
    num: ["fn"], den: ["tn", "fn"] },
  { key: "bacc", group: "avg", name: "Balanced accuracy", aka: "",
    avg: ["tpr", "tnr"] },
];
const METRIC = Object.fromEntries(METRICS.map(m => [m.key, m]));

// The ones most papers report; "Just the popular ones" hides the rest on
// The metrics and Test yourself tabs.
const POPULAR = ["prev", "acc", "tpr", "fpr", "ppv"];
const SETTINGS = { popular: true };

/** Metrics listed on The metrics tab, under the toggle. */
function shownMetrics() {
  return METRICS.filter(m => !SETTINGS.popular || POPULAR.includes(m.key));
}

function cellSum(c, cells) { return cells.reduce((s, k) => s + c[k], 0); }

/** Value of a metric (or its key) on counts c; NaN on a 0 denominator. */
function metricValue(m, c) {
  if (typeof m === "string") m = METRIC[m];
  if (m.avg) return (metricValue(m.avg[0], c) + metricValue(m.avg[1], c)) / 2;
  const d = cellSum(c, m.den);
  return d ? cellSum(c, m.num) / d : NaN;
}

function allMetrics(c) {
  return Object.fromEntries(METRICS.map(m => [m.key, metricValue(m, c)]));
}

/** Value as shown, a percentage. */
function metricText(key, v) { return pct(v); }

/** Colored cell name. */
function chip(k) {
  return `<span class="chip ${k}">${CELL_LABEL[k]}</span>`;
}

/** Sum of cells as chips, repeats folded into a factor: 2·TP + FP. */
function termsHTML(cells) {
  if (cells.length === 4 && CELLS.every(k => cells.includes(k))) {
    return `<span class="chip all">N</span>`;
  }
  const mult = new Map();
  for (const k of cells) mult.set(k, (mult.get(k) || 0) + 1);
  return [...mult].map(([k, m]) => (m > 1 ? `${m}·` : "") + chip(k))
    .join(" + ");
}

function fracHTML(top, bottom) {
  return `<span class="frac"><span>${top}</span><span>${bottom}</span></span>`;
}

/** Metric's definition as a fraction of chips. */
function defHTML(key) {
  const m = METRIC[key];
  if (m.avg) {
    return fracHTML(`${METRIC[m.avg[0]].name} + ${METRIC[m.avg[1]].name}`,
      "2");
  }
  return fracHTML(termsHTML(m.num), termsHTML(m.den));
}

