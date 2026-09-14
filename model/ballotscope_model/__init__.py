"""Auditable forecasting primitives for BallotScope."""

from .simulation import MarginSummary, RaceSpec, SimulationConfig, simulate_races
from .validation import Observation, evaluate, holdout_splits

__all__ = [
    "MarginSummary",
    "Observation",
    "RaceSpec",
    "SimulationConfig",
    "evaluate",
    "holdout_splits",
    "simulate_races",
]
