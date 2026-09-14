# BallotScope model core

This package is the first executable seam for the eventual Python forecasting service. It intentionally accepts already-validated race inputs and does not retrieve live election data.

It currently provides:

- reproducible, seeded correlated margin simulations;
- moderately fat-tailed Student-t shocks;
- 50%, 80%, and 95% central intervals;
- race win probabilities from simulated margins;
- cycle-held-out split construction;
- margin MAE, Brier score, log loss, and interval coverage.

The fixtures in `tests/` are synthetic. They are not historical election data and do not represent public forecasts.

```bash
python -m unittest discover -s model/tests -v
```
