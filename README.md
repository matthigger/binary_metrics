# binary_metrics

Interactive teaching demo of binary classification metrics: every one is a
ratio of counts from the 2 × 2 confusion matrix. Three tabs:

- **Confusion matrix.** A coin flip (equal priors, chance accuracy), a
  rapid strep test on 1,000 children and a mammogram screen. Edit the four
  counts in the table, or drag the dividers of the mosaic beside it (rows
  = truth, height ∝ class count, split by the prediction, so area ∝ count;
  the total stays fixed). A tour highlights each metric's numerator
  (filled) and denominator (outlined). "Just the popular ones" (on by
  default) limits this tab and the game to prevalence, accuracy, TPR, FPR
  and precision; off, it adds FNR, TNR, FDR, NPV, FOR and balanced
  accuracy.
- **Summary metrics.** AUC and F1. Scores of each class are drawn from two
  normals (separation, prevalence and sample count are sliders). Drag the
  threshold on the score strip, or along either curve, and watch it move
  along the ROC and precision-recall curves; a Venn diagram shows F1 as
  the Dice overlap of the true and predicted positives at that threshold.
  Sweep animates the threshold; Estimate backwards (Undo backwards)
  mirrors a worse-than-guessing classifier; AUC as pairs shades the ROC
  square as one cell per (Truth 1, Truth 0) pair, so the area under the
  staircase is the share of correctly ordered pairs.
- **Would you rather?** A scenario (strep, spam, fraud, bots, defective
  screens), a goal (accuracy, cost, precision, recall, false alarms)
  and two classifiers each described by two clues in different terms.
  Rounds are kept only when the clues, as rounded on screen, settle the
  goal. The reveal shows both matrices and how to derive them.

Plain HTML/CSS/JS with SVG: no build step and no dependencies.

## Run locally

Open `index.html` in a browser, or serve it:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

Link straight to a tab with `#confusion-matrix`, `#summary-metrics` or
`#would-you-rather`.
