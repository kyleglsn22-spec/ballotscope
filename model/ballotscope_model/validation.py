"""Cycle-held-out validation metrics for synthetic and real model outputs."""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Iterable, Sequence


@dataclass(frozen=True)
class Observation:
    cycle: int
    predicted_probability: float
    actual_winner: bool
    predicted_margin: float
    actual_margin: float
    interval_low: float
    interval_high: float


@dataclass(frozen=True)
class Evaluation:
    brier: float
    log_loss: float
    margin_mae: float
    interval_coverage: float
    count: int


def holdout_splits(observations: Sequence[Observation], test_cycles: Iterable[int]) -> list[tuple[int, tuple[Observation, ...], tuple[Observation, ...]]]:
    """Build expanding-window folds with whole cycles held out."""

    folds: list[tuple[int, tuple[Observation, ...], tuple[Observation, ...]]] = []
    for cycle in sorted(set(test_cycles)):
        train = tuple(observation for observation in observations if observation.cycle < cycle)
        test = tuple(observation for observation in observations if observation.cycle == cycle)
        if not train or not test:
            raise ValueError(f"cycle {cycle} requires non-empty prior training and test data")
        folds.append((cycle, train, test))
    return folds


def evaluate(observations: Sequence[Observation]) -> Evaluation:
    if not observations:
        raise ValueError("cannot evaluate empty observations")
    probabilities = [min(1.0, max(0.0, observation.predicted_probability)) for observation in observations]
    outcomes = [1.0 if observation.actual_winner else 0.0 for observation in observations]
    brier = sum((probability - outcome) ** 2 for probability, outcome in zip(probabilities, outcomes)) / len(observations)
    epsilon = 1e-12
    log_loss = -sum(outcome * math.log(max(epsilon, probability)) + (1 - outcome) * math.log(max(epsilon, 1 - probability)) for probability, outcome in zip(probabilities, outcomes)) / len(observations)
    margin_mae = sum(abs(observation.predicted_margin - observation.actual_margin) for observation in observations) / len(observations)
    coverage = sum(observation.interval_low <= observation.actual_margin <= observation.interval_high for observation in observations) / len(observations)
    return Evaluation(brier=brier, log_loss=log_loss, margin_mae=margin_mae, interval_coverage=coverage, count=len(observations))
