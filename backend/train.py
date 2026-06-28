from __future__ import annotations

import argparse
import copy
import math
import random
from typing import List, Tuple
from pathlib import Path
import json
import time

import torch
from main import (
    Ball,
    GameState,
    ShotPolicy,
    MODEL_PATH,
    TABLE_W,
    TABLE_H,
    MAX_POWER,
    BALL_DIAMETER,
    build_features,
    choose_target_ball,
    make_candidate_angles,
    rollout,
)

STATUS_PATH = Path("training_status.json")

def write_status(generation: int, best_score: float, champion_path: str = "shot_policy.pt") -> None:
    STATUS_PATH.write_text(
        json.dumps(
            {
                "generation": generation,
                "best_score": best_score,
                "champion_path": champion_path,
                "updated_at": time.time(),
            },
            indent=2,
        )
    )

DEVICE = torch.device("cpu")


def load_policy() -> ShotPolicy:
    model = ShotPolicy().to(DEVICE)
    if MODEL_PATH.exists():
        state = torch.load(MODEL_PATH, map_location=DEVICE)
        model.load_state_dict(state)
        print(f"Loaded policy from {MODEL_PATH}")
    else:
        print("No saved policy found; starting from random weights.")
    model.eval()
    return model


def save_policy(model: ShotPolicy) -> None:
    torch.save(model.state_dict(), MODEL_PATH)


def mutate_policy(
    base: ShotPolicy,
    sigma: float = 0.03,
    reset_prob: float = 0.0,
) -> ShotPolicy:
    child = ShotPolicy().to(DEVICE)
    child.load_state_dict(copy.deepcopy(base.state_dict()))

    with torch.no_grad():
        for param in child.parameters():
            if not param.is_floating_point():
                continue

            noise = torch.randn_like(param) * sigma
            param.add_(noise)

            if reset_prob > 0.0:
                mask = torch.rand_like(param) < reset_prob
                if mask.any():
                    param[mask] = torch.randn_like(param)[mask] * sigma

    child.eval()
    return child


def ball_color(ball_id: str) -> str:
    if ball_id == "cue":
        return "white"
    return "gray"


def random_ball_position(existing: List[Ball], margin: float = BALL_DIAMETER * 1.2) -> Tuple[float, float]:
    left = 58.0 + BALL_DIAMETER
    right = TABLE_W - 60.0 - BALL_DIAMETER
    top = 50.0 + BALL_DIAMETER
    bottom = TABLE_H - 55.0 - BALL_DIAMETER

    for _ in range(500):
        x = random.uniform(left, right)
        y = random.uniform(top, bottom)

        ok = True
        for b in existing:
            if math.hypot(x - b.x, y - b.y) < margin:
                ok = False
                break

        if ok:
            return x, y

    # fallback, should almost never happen
    return (left + right) / 2.0, (top + bottom) / 2.0


def sample_state() -> GameState:
    balls: List[Ball] = [
        Ball(
            id="cue",
            x=120.0,
            y=250.0,
            vx=0.0,
            vy=0.0,
            color="white",
        )
    ]

    # Keep the first trainer simple: a random small rack.
    n_objects = random.randint(3, 8)
    ids = random.sample([str(i) for i in range(1, 16)], n_objects)

    for ball_id in ids:
        x, y = random_ball_position(balls)
        balls.append(
            Ball(
                id=ball_id,
                x=x,
                y=y,
                vx=0.0,
                vy=0.0,
                color=ball_color(ball_id),
            )
        )

    return GameState(
        balls=balls,
        currentPlayer="ai",
        gameOver=False,
        winner=None,
        currentShotPocketed=[],
    )


def pick_shot_with_policy(
    model: ShotPolicy,
    state: GameState,
) -> Tuple[float, float, float]:
    cue = next((b for b in state.balls if b.id == "cue"), None)
    target = choose_target_ball(state.balls)

    if cue is None or target is None:
        return 0.0, 0.0, float("-inf")

    powers = [12.0, 18.0, 24.0, 30.0, 36.0, 42.0, 48.0]
    angles = make_candidate_angles(target, cue)

    best_angle = 0.0
    best_power = 0.0
    best_score = float("-inf")

    with torch.no_grad():
        for angle in angles:
            for power in powers:
                features = build_features(state, angle, power, target)
                x = torch.tensor(features, dtype=torch.float32, device=DEVICE).unsqueeze(0)
                score = float(model(x).item())

                if score > best_score:
                    best_score = score
                    best_angle = angle
                    best_power = power

    return best_angle, best_power, best_score


def reward_from_rollout(
    final_balls: List[Ball],
    pocketed: List[str],
    scratched: bool,
) -> float:
    reward = 0.0

    object_pocketed = sum(1 for ball_id in pocketed if ball_id != "cue")
    reward += object_pocketed * 1000.0

    if scratched or "cue" in pocketed:
        reward -= 2500.0

    object_left = sum(1 for b in final_balls if b.id != "cue")
    if object_left == 0:
        reward += 5000.0

    cue = next((b for b in final_balls if b.id == "cue"), None)
    if cue is not None:
        center_dist = math.hypot(cue.x - TABLE_W * 0.5, cue.y - TABLE_H * 0.5)
        reward -= center_dist * 0.05

    return reward


def evaluate_model(model: ShotPolicy, states: List[GameState]) -> float:
    total = 0.0

    for state in states:
        angle, power, _ = pick_shot_with_policy(model, state)
        final_balls, pocketed, scratched = rollout(state.balls, angle, power)
        total += reward_from_rollout(final_balls, pocketed, scratched)

    return total / max(1, len(states))


def make_population(champion: ShotPolicy, pop_size: int, sigma: float) -> List[ShotPolicy]:
    population = [champion]
    for _ in range(pop_size - 1):
        population.append(mutate_policy(champion, sigma=sigma))
    return population


def train(
    generations: int,
    population_size: int,
    eval_states: int,
    sigma: float,
) -> None:
    champion = load_policy()
    best_score = float("-inf")

    for gen in range(generations):
        states = [sample_state() for _ in range(eval_states)]
        population = make_population(champion, population_size, sigma)

        scored: List[Tuple[float, ShotPolicy]] = []
        for idx, model in enumerate(population):
            score = evaluate_model(model, states)
            scored.append((score, model))
            print(f"gen {gen:04d} | candidate {idx:02d} | score {score:10.2f}")

        scored.sort(key=lambda item: item[0], reverse=True)
        top_score, top_model = scored[0]

        print(f"gen {gen:04d} | best {top_score:10.2f} | previous best {best_score:10.2f}")

        if top_score > best_score:
            best_score = top_score
            champion = top_model
            save_policy(champion)
            print(f"saved new champion to {MODEL_PATH}")

        write_status(gen, best_score)
    print(f"done | best score {best_score:.2f}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generations", type=int, default=200)
    parser.add_argument("--population", type=int, default=24)
    parser.add_argument("--eval-states", type=int, default=32)
    parser.add_argument("--sigma", type=float, default=0.03)
    args = parser.parse_args()

    train(
        generations=args.generations,
        population_size=args.population,
        eval_states=args.eval_states,
        sigma=args.sigma,
    )


if __name__ == "__main__":
    main()
