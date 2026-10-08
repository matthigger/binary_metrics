// Shared helpers: SVG nodes, pointer coordinates, seeded random numbers and
// number formatting.

const SVGNS = "http://www.w3.org/2000/svg";

function node(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.append(el);
  return el;
}

/** SVG text node holding the string s. */
function text(s, attrs = {}, parent = null) {
  const el = node("text", attrs, parent);
  el.textContent = s;
  return el;
}

/** Pointer position in the viewBox units of an SVG. */
function svgPoint(el, e) {
  const pt = el.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(el.getScreenCTM().inverse());
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Seeded uniform [0, 1) generator (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw (Box-Muller). */
function gauss(r) {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

/** Percentage to a fixed number of decimals; NaN is undefined. */
function pct(x, digits = 1) {
  if (!Number.isFinite(x)) return "undefined";
  return `${(100 * x).toFixed(digits)}%`;
}

function cap(s) { return s[0].toUpperCase() + s.slice(1); }

/** Count, rounded to whole, with a thousands separator. */
function num(n) { return Math.round(n).toLocaleString("en-US"); }

/** Signed decimal with a true minus sign. */
function fmt(x, digits = 2) {
  return (x < 0 ? "−" : "") + Math.abs(x).toFixed(digits);
}
