# binary_metrics

**Live demo:** <https://matthigger.github.io/binary_metrics/>

Interactive teaching demo of binary classification metrics: many are
ratios of counts from the 2 × 2 confusion matrix (AUC, over every
threshold, is not). Three tabs:

- **The metrics.** A coin flip (guessing heads or tails: chance accuracy), a
  treadmill heart test (the default), a rapid strep test and a mammogram
  screen. Edit the four counts in the table, or drag the dividers of the mosaic
  beside it (rows = truth, height ∝ class count, split by the prediction, so
  area ∝ count; the total stays fixed). A tour highlights each metric's
  numerator (darker) within its denominator (the rest dimmed). "Just the
  popular ones" (on by default) limits this tab and the game to prior,
  accuracy, TPR, FPR and precision; off, it adds FNR, TNR, FDR, NPV, FOR and
  balanced accuracy.
- **ROC curve.** One number that needs no threshold: AUC. Scores of each
  class are drawn from two normals (separation, prior and sample count
  are sliders). Drag the threshold on the score strip, where each dot is
  filled by its true class and bordered by its prediction, or along the
  curve, and watch it trace the ROC curve. Sweep animates the threshold;
  Estimate backwards (Undo backwards) predicts 1 on the low-score side, leaving
  the scores in place and mirroring the curve (AUC becomes 1 − AUC).
- **Test yourself.** Three kinds of round, on scenarios (strep, spam,
  fraud, bots, defective screens). *Which number?* draws lines from
  stakeholder questions ("of the children who test positive, what share
  really have strep?") to the metrics that answer them, each shown with a
  random synonym. *New prior* moves a test with fixed TPR and FPR to a
  population with another prior: does each of TPR, FPR, precision and
  accuracy go up, stay or go down? *Would you rather?* gives two
  classifiers by TPR and FPR only; the goal is fewest mistakes, and every
  round is one the prior decides (the other classifier would win at 50%).
  Reveals show the counts and to-scale mosaics.

Resting the pointer on a metric or cell anywhere shows a plain-English
sentence with natural frequencies ("of every 100 children with strep, the
rapid strep test catches about 86").

Plain HTML/CSS/JS with SVG: no build step and no dependencies.

## Run locally

Open `index.html` in a browser, or serve it:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

Link straight to a tab with `#the-metrics`, `#roc` or
`#test-yourself`.
