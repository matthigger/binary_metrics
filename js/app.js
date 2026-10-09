// Tabs, the "Just the popular ones" toggle, keyboard routing and the footer
// build stamp. Each tab lives in its own file: table.js (Confusion matrix),
// roc.js (ROC curve) and game.js (Would you rather).

const MODES = {
  table: { hash: "#confusion-matrix", draw: () => tDraw(), key: e => tKey(e) },
  roc: { hash: "#roc", draw: () => rDraw(), key: e => rKey(e) },
  game: { hash: "#would-you-rather", draw: () => gDraw(),
    key: e => gKey(e) },
};
let mode = "table";

function setMode(m) {
  mode = m;
  history.replaceState(null, "", MODES[m].hash);
  for (const t of document.querySelectorAll(".tab")) {
    t.setAttribute("aria-selected", t.dataset.mode === m);
  }
  for (const el of document.querySelectorAll("[data-show]")) {
    el.hidden = !el.dataset.show.split(" ").includes(m);
  }
  if (m !== "roc") stopSweep();
  MODES[m].draw();
}

for (const t of document.querySelectorAll(".tab")) {
  t.onclick = () => setMode(t.dataset.mode);
}

document.getElementById("popular").onchange = e => {
  SETTINGS.popular = e.target.checked;
  tPopular();
  gCheat();
  MODES[mode].draw();
};

document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) {
    return;
  }
  if (MODES[mode].key(e)) e.preventDefault();
});

(function () {
  const el = document.getElementById("build");
  const repo = "https://github.com/matthigger/binary_metrics";
  if (!BUILD) { el.textContent = "local copy"; return; }
  const when = new Date(BUILD.time).toLocaleString("en-US", {
    dateStyle: "medium", timeStyle: "short" });
  el.innerHTML = `build <a href="${repo}/commit/${BUILD.sha}">${
    BUILD.sha.slice(0, 7)}</a>, ${when}`;
})();

tBuild();
setPreset("stress");
rBuild();
gBuild();
setMode(location.hash === "#summary-metrics" ? "roc"
  : Object.keys(MODES).find(k => MODES[k].hash === location.hash)
  || "table");
