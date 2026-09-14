import unittest

from model.ballotscope_model.simulation import RaceSpec, SimulationConfig, simulate_races
from model.ballotscope_model.validation import Observation, evaluate, holdout_splits


class SimulationTests(unittest.TestCase):
    def test_seed_makes_correlated_simulation_reproducible(self):
        specs = {
            "race-a": RaceSpec(0.5, "north", 3.0, 2.0, 1.0),
            "race-b": RaceSpec(-0.5, "north", 3.0, 2.0, 1.0),
        }
        config = SimulationConfig(draws=1000, seed=42)
        first = simulate_races(specs, config)
        second = simulate_races(specs, config)
        self.assertEqual(first, second)
        self.assertGreater(first["race-a"][1].p95.high, first["race-a"][1].p50.high)

    def test_shared_region_shock_creates_positive_cross_race_correlation(self):
        specs = {
            "race-a": RaceSpec(0.0, "north", 1.0, 8.0, 0.5),
            "race-b": RaceSpec(0.0, "north", 1.0, 8.0, 0.5),
        }
        result = simulate_races(specs, SimulationConfig(draws=1500, seed=3))
        left = result["race-a"][0]
        right = result["race-b"][0]
        left_mean = sum(left) / len(left)
        right_mean = sum(right) / len(right)
        covariance = sum((a - left_mean) * (b - right_mean) for a, b in zip(left, right))
        self.assertGreater(covariance, 0)


class ValidationTests(unittest.TestCase):
    def test_cycles_are_held_out_as_whole_units(self):
        observations = [
            Observation(2020, 0.6, True, 1, 2, -3, 4),
            Observation(2022, 0.4, False, -1, -2, -3, 3),
            Observation(2024, 0.7, True, 2, 1, -1, 4),
        ]
        folds = holdout_splits(observations, [2022, 2024])
        self.assertEqual([fold[0] for fold in folds], [2022, 2024])
        self.assertEqual({item.cycle for item in folds[0][1]}, {2020})
        self.assertEqual({item.cycle for item in folds[1][1]}, {2020, 2022})

    def test_metrics_are_bounded_and_counted(self):
        result = evaluate([
            Observation(2022, 0.75, True, 1.0, 1.5, -1, 2),
            Observation(2022, 0.25, False, -1.0, -2.0, -3, 1),
        ])
        self.assertEqual(result.count, 2)
        self.assertGreaterEqual(result.brier, 0)
        self.assertLessEqual(result.brier, 1)
        self.assertEqual(result.interval_coverage, 1.0)


if __name__ == "__main__":
    unittest.main()
