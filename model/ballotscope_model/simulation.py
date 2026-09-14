"""Deterministic correlated simulation primitives.

The production model will supply learned parameters and validated input bundles.
This module only handles the reproducible simulation layer and never fetches data.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
import random
from typing import Mapping


@dataclass(frozen=True)
class SimulationConfig:
    draws: int = 10_000
    tail_df: int = 7
    seed: int = 0

    def __post_init__(self) -> None:
        if self.draws < 100:
            raise ValueError("draws must be at least 100 for a stable summary")
        if self.tail_df < 3:
            raise ValueError("tail_df must be at least 3")


@dataclass(frozen=True)
class RaceSpec:
    expected_margin: float
    region: str
    national_sigma: float
    regional_sigma: float
    local_sigma: float
    national_loading: float = 1.0
    regional_loading: float = 1.0

    def __post_init__(self) -> None:
        values = (self.expected_margin, self.national_sigma, self.regional_sigma, self.local_sigma, self.national_loading, self.regional_loading)
        if not all(math.isfinite(value) for value in values):
            raise ValueError("race parameters must be finite")
        if min(self.national_sigma, self.regional_sigma, self.local_sigma) < 0:
            raise ValueError("uncertainty scales cannot be negative")


@dataclass(frozen=True)
class Interval:
    low: float
    high: float


@dataclass(frozen=True)
class MarginSummary:
    mean: float
    win_probability: float
    p50: Interval
    p80: Interval
    p95: Interval


def _student_t(rng: random.Random, degrees_of_freedom: int) -> float:
    numerator = rng.gauss(0.0, 1.0)
    denominator = math.sqrt(sum(rng.gauss(0.0, 1.0) ** 2 for _ in range(degrees_of_freedom)) / degrees_of_freedom)
    return numerator / denominator


def _quantile(values: list[float], probability: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def _summary(margins: list[float]) -> MarginSummary:
    if not margins:
        raise ValueError("cannot summarize empty margins")
    return MarginSummary(
        mean=sum(margins) / len(margins),
        win_probability=sum(margin > 0 for margin in margins) / len(margins),
        p50=Interval(_quantile(margins, 0.25), _quantile(margins, 0.75)),
        p80=Interval(_quantile(margins, 0.10), _quantile(margins, 0.90)),
        p95=Interval(_quantile(margins, 0.025), _quantile(margins, 0.975)),
    )


def simulate_races(specs: Mapping[str, RaceSpec], config: SimulationConfig) -> dict[str, tuple[tuple[float, ...], MarginSummary]]:
    """Simulate races with shared national and region shocks.

    A common national draw and a shared region draw are reused across races in
    the same iteration. This preserves correlated uncertainty rather than
    treating every race as an independent coin flip.
    """

    rng = random.Random(config.seed)
    margins: dict[str, list[float]] = {race_id: [] for race_id in specs}
    for _ in range(config.draws):
        national_shock = _student_t(rng, config.tail_df)
        regional_shocks: dict[str, float] = {}
        for race_id, spec in specs.items():
            regional_shock = regional_shocks.setdefault(spec.region, _student_t(rng, config.tail_df))
            local_shock = _student_t(rng, config.tail_df)
            margins[race_id].append(
                spec.expected_margin
                + spec.national_loading * spec.national_sigma * national_shock
                + spec.regional_loading * spec.regional_sigma * regional_shock
                + spec.local_sigma * local_shock
            )
    return {race_id: (tuple(values), _summary(values)) for race_id, values in margins.items()}
