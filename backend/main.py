from __future__ import annotations

import math
import random
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Ball(BaseModel):
    id: str
    x: float
    y: float
    vx: float
    vy: float
    color: str

class GameState(BaseModel):
    balls: list[Ball]
    currentPlayer: str
    gameOver: bool
    winner: Optional[str] = None
    currentShotPocketed: list[str] = Field(default_factory=list)

class Shot(BaseModel):
    angle: float
    power: float

class CandidateShot(BaseModel):
    angle: float
    power: float
    fitness: float
    target_id: Optional[str] = None

class PredictionResponse(BaseModel):
    angle: float
    power: float
    generation: int = 0
    candidates: list[CandidateShot] = Field(default_factory=list)

TABLE_W = 900.0
TABLE_H = 500.0
MAX_POWER = 50.0

RAIL_LEFT = 58.0
RAIL_TOP = 50.0
RAIL_RIGHT = 60.0
RAIL_BOTTOM = 55.0

BALL_DIAMETER = 25.0
BALL_RADIUS = BALL_DIAMETER / 2.0

POCKET_SINK_RADIUS = 22.0
SIDE_POCKET_SINK_RADIUS = 10.0
CORNER_POCKET_MOUTH_RADIUS = 25.0
SIDE_POCKET_MOUTH_RADIUS = 20.0

FRICTION = 0.985
STOP_SPEED = 0.06

POCKETS = [
    (57.0, 44.0),
    (TABLE_W / 2, 45.0),
    (TABLE_W - 62.0, 43.0),
    (57.0, TABLE_H - 43.0),
    (TABLE_W / 2, TABLE_H - 50.0),
    (TABLE_W - 57.0, TABLE_H - 43.0),
]

def dist(x1: float, y1: float, x2: float, y2: float) -> float:
    return math.hypot(x2 - x1, y2 - y1)

def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))

def is_at_rest(balls: list[Ball]) -> bool:
    return all(math.hypot(b.vx, b.vy) < 0.01 for b in balls)

def near_pocket_mouth(x: float, y: float) -> bool:
    for i, (px, py) in enumerate(POCKETS):
        mouth = SIDE_POCKET_MOUTH_RADIUS if i in (1, 4) else CORNER_POCKET_MOUTH_RADIUS
        if dist(x, y, px, py) < mouth:
            return True
    return False

def should_sink(ball: Ball) -> bool:
    for i, (px, py) in enumerate(POCKETS):
        sink = SIDE_POCKET_SINK_RADIUS if i in (1, 4) else POCKET_SINK_RADIUS
        if dist(ball.x, ball.y, px, py) < sink:
            return True
    return False

def resolve_collision(a: Ball, b: Ball) -> tuple[Ball, Ball] | None:
    dx = b.x - a.x
    dy = b.y - a.y
    d = math.hypot(dx, dy)
    if d == 0.0 or d >= BALL_DIAMETER:
        return None

    nx = dx / d
    ny = dy / d

    rel_vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
    if rel_vn > 0:
        return None

    overlap = BALL_DIAMETER - d

    a_x = a.x - nx * overlap / 2.0
    a_y = a.y - ny * overlap / 2.0
    b_x = b.x + nx * overlap / 2.0
    b_y = b.y + ny * overlap / 2.0

    a_speed = a.vx * nx + a.vy * ny
    b_speed = b.vx * nx + b.vy * ny

    a_next = a.model_copy(update={
        "x": a_x,
        "y": a_y,
        "vx": a.vx + (b_speed - a_speed) * nx,
        "vy": a.vy + (b_speed - a_speed) * ny,
    })
    b_next = b.model_copy(update={
        "x": b_x,
        "y": b_y,
        "vx": b.vx + (a_speed - b_speed) * nx,
        "vy": b.vy + (a_speed - b_speed) * ny,
    })
    return a_next, b_next

def apply_shot(balls: list[Ball], angle: float, power: float) -> list[Ball]:
    cue_vx = math.cos(angle) * power
    cue_vy = math.sin(angle) * power

    out: list[Ball] = []
    for b in balls:
        if b.id == "cue":
            out.append(b.model_copy(update={"vx": cue_vx, "vy": cue_vy}))
        else:
            out.append(b)
    return out

def step_physics(balls: list[Ball]) -> tuple[list[Ball], list[str]]:
    left = RAIL_LEFT + BALL_RADIUS
    right = TABLE_W - RAIL_RIGHT - BALL_RADIUS
    top = RAIL_TOP + BALL_RADIUS
    bottom = TABLE_H - RAIL_BOTTOM - BALL_RADIUS

    moved: list[Ball] = []
    for b in balls:
        x = b.x + b.vx
        y = b.y + b.vy
        vx = b.vx * FRICTION
        vy = b.vy * FRICTION

        if math.hypot(vx, vy) < STOP_SPEED:
            vx = vy = 0.0

        if x < left:
            if not near_pocket_mouth(x, y):
                x = left
                vx *= -1
        elif x > right:
            if not near_pocket_mouth(x, y):
                x = right
                vx *= -1

        if y < top:
            if not near_pocket_mouth(x, y):
                y = top
                vy *= -1
        elif y > bottom:
            if not near_pocket_mouth(x, y):
                y = bottom
                vy *= -1

        moved.append(b.model_copy(update={"x": x, "y": y, "vx": vx, "vy": vy}))

    for i in range(len(moved)):
        for j in range(i + 1, len(moved)):
            hit = resolve_collision(moved[i], moved[j])
            if hit:
                moved[i], moved[j] = hit

    kept: list[Ball] = []
    pocketed: list[str] = []
    for b in moved:
        if should_sink(b):
            pocketed.append(b.id)
        else:
            kept.append(b)

    return kept, pocketed

def rollout(balls: list[Ball], angle: float, power: float, max_steps: int = 180) -> tuple[list[Ball], list[str], bool]:
    current = apply_shot(balls, angle, power)
    pocketed: list[str] = []
    scratched = False

    for _ in range(max_steps):
        current, step_pocketed = step_physics(current)
        pocketed.extend(step_pocketed)
        scratched = scratched or ("cue" in step_pocketed)
        if is_at_rest(current):
            break

    return current, pocketed, scratched

def choose_target_ball(balls: list[Ball]) -> Optional[Ball]:
    cue = next((b for b in balls if b.id == "cue"), None)
    if cue is None:
        return None

    objects = [b for b in balls if b.id != "cue"]
    if not objects:
        return None

    non_eight = [b for b in objects if b.id != "8"]
    candidates = non_eight or objects

    return min(
        candidates,
        key=lambda b: dist(cue.x, cue.y, b.x, b.y) * 0.6
        + min(dist(b.x, b.y, px, py) for px, py in POCKETS) * 0.4,
    )

def score_shot(state: GameState, angle: float, power: float, target_id: str) -> float:
    final_balls, pocketed, scratched = rollout(state.balls, angle, power)

    score = 0.0

    if "cue" in pocketed:
        score -= 2500.0
    if scratched:
        score -= 2500.0
    if target_id in pocketed:
        score += 1800.0

    target = next((b for b in final_balls if b.id == target_id), None)
    if target is None:
        score += 1200.0
    else:
        pocket_dist = min(dist(target.x, target.y, px, py) for px, py in POCKETS)
        score += max(0.0, 240.0 - pocket_dist * 1.5)

    cue = next((b for b in final_balls if b.id == "cue"), None)
    if cue is not None:
        score += max(0.0, 250.0 - dist(cue.x, cue.y, TABLE_W * 0.5, TABLE_H * 0.5) * 0.5)

    return score

def make_candidate_angles(target: Ball, cue: Ball) -> list[float]:
    base = math.atan2(target.y - cue.y, target.x - cue.x)
    offsets = [-0.35, -0.2, -0.1, 0.0, 0.1, 0.2, 0.35]
    return [base + o for o in offsets]

def predict(state: GameState) -> PredictionResponse:
    cue = next((b for b in state.balls if b.id == "cue"), None)
    if cue is None or state.gameOver:
        return PredictionResponse(angle=0.0, power=0.0, generation=0, candidates=[])

    target = choose_target_ball(state.balls)
    if target is None:
        return PredictionResponse(angle=0.0, power=0.0, generation=0, candidates=[])

    powers = [12.0, 18.0, 24.0, 30.0, 36.0, 42.0, 48.0]
    angles = make_candidate_angles(target, cue)

    scored: list[CandidateShot] = []
    best_score = -1e18
    best_shot = Shot(angle=0.0, power=0.0)

    for angle in angles:
        for power in powers:
            power = clamp(power, 0.0, MAX_POWER)
            fitness = score_shot(state, angle, power, target.id)
            cand = CandidateShot(
                angle=angle,
                power=power,
                fitness=fitness,
                target_id=target.id,
            )
            scored.append(cand)

            if fitness > best_score:
                best_score = fitness
                best_shot = Shot(angle=angle, power=power)

    scored.sort(key=lambda c: c.fitness, reverse=True)

    return PredictionResponse(
        angle=best_shot.angle,
        power=best_shot.power,
        generation=0,
        candidates=scored[:8],
    )

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/predict-shot", response_model=PredictionResponse)
def predict_shot(state: GameState):
    return predict(state)
