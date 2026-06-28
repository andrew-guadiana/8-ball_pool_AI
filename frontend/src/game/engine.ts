import type { Ball, GameState, Shot, StepResult } from "./types"
import { TABLE_W, TABLE_H, RAIL_LEFT, RAIL_TOP, RAIL_RIGHT, RAIL_BOTTOM, BALL_RADIUS, BALL_DIAMETER,
  POCKET_SINK_RADIUS, SIDE_POCKET_SINK_RADIUS, CORNER_POCKET_MOUTH_RADIUS, SIDE_POCKET_MOUTH_RADIUS,
  pockets, } from "./constants"

const FRICTION = 0.985
const STOP_SPEED = 0.06

const CUE_START_X = 120
const CUE_START_Y = 250

const RACK_START_X = 650
const RACK_START_Y = 250
const BALL_GAP = 1
const SPACING = BALL_DIAMETER + BALL_GAP

const objectBallColors: Record<string, string> = {
  "1": "yellow",
  "2": "blue",
  "3": "red",
  "4": "purple",
  "5": "orange",
  "6": "green",
  "7": "maroon",
  "8": "black",
  "9": "yellow",
  "10": "blue",
  "11": "red",
  "12": "purple",
  "13": "orange",
  "14": "green",
  "15": "maroon",
}

export function createRack(): Ball[] {
  const balls: Ball[] = [
    { id: "cue", x: CUE_START_X, y: CUE_START_Y, vx: 0, vy: 0, color: "white" },
  ]

  let n = 1
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      balls.push({
        id: String(n),
        x: RACK_START_X + row * SPACING * 0.87,
        y: RACK_START_Y - row * (BALL_RADIUS - 1) + i * SPACING,
        vx: 0,
        vy: 0,
        color: objectBallColors[String(n)] ?? "gray",
      })
      n++
    }
  }

  return balls
}

export function applyShot(balls: Ball[], angle: number, power: number): Ball[] {
  const vx = Math.cos(angle) * power
  const vy = Math.sin(angle) * power

  return balls.map((ball) =>
    ball.id === "cue" ? { ...ball, vx, vy } : ball
  )
}

export function isAtRest(balls: Ball[]) {
  return balls.every((ball) => Math.hypot(ball.vx, ball.vy) < 0.01)
}

export function stepPhysics(balls: Ball[]): StepResult {
  const leftBound = RAIL_LEFT + BALL_RADIUS
  const rightBound = TABLE_W - RAIL_RIGHT - BALL_RADIUS
  const topBound = RAIL_TOP + BALL_RADIUS
  const bottomBound = TABLE_H - RAIL_BOTTOM - BALL_RADIUS

  const moved = balls.map((ball) => {
    let x = ball.x + ball.vx
    let y = ball.y + ball.vy

    let vx = ball.vx * FRICTION
    let vy = ball.vy * FRICTION

    if (Math.hypot(vx, vy) < STOP_SPEED) {
      vx = 0
      vy = 0
    }

    if (x < leftBound) {
      if (!nearPocketMouth(x, y)) {
        x = leftBound
        vx *= -1
      }
    } else if (x > rightBound) {
      if (!nearPocketMouth(x, y)) {
        x = rightBound
        vx *= -1
      }
    }

    if (y < topBound) {
      if (!nearPocketMouth(x, y)) {
        y = topBound
        vy *= -1
      }
    } else if (y > bottomBound) {
      if (!nearPocketMouth(x, y)) {
        y = bottomBound
        vy *= -1
      }
    }

    return { ...ball, x, y, vx, vy }
  })

  for (let i = 0; i < moved.length; i++) {
    for (let j = i + 1; j < moved.length; j++) {
      const collision = resolveBallCollision(moved[i], moved[j], BALL_RADIUS)
      if (collision) {
        moved[i] = collision[0]
        moved[j] = collision[1]
      }
    }
  }

  const pocketed: string[] = []
  const ballsLeft: Ball[] = []

  for (const ball of moved) {
    if (shouldSink(ball)) {
      pocketed.push(ball.id)
    } else {
      ballsLeft.push(ball)
    }
  }

  return { balls: ballsLeft, pocketed }
}

export function resolveBallCollision(a: Ball, b: Ball, radius: number) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy)

  if (dist === 0 || dist >= radius * 2) return null

  const nx = dx / dist
  const ny = dy / dist

  const relVn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
  if (relVn > 0) return null

  const overlap = radius * 2 - dist

  const aNext = {
    ...a,
    x: a.x - nx * (overlap / 2),
    y: a.y - ny * (overlap / 2),
  }

  const bNext = {
    ...b,
    x: b.x + nx * (overlap / 2),
    y: b.y + ny * (overlap / 2),
  }

  const aSpeed = a.vx * nx + a.vy * ny
  const bSpeed = b.vx * nx + b.vy * ny

  return [
    {
      ...aNext,
      vx: a.vx + (bSpeed - aSpeed) * nx,
      vy: a.vy + (bSpeed - aSpeed) * ny,
    },
    {
      ...bNext,
      vx: b.vx + (aSpeed - bSpeed) * nx,
      vy: b.vy + (aSpeed - bSpeed) * ny,
    },
  ] as const
}

export function nearPocketMouth(x: number, y: number) {
  return pockets.some((p, i) => {
    const isSidePocket = i === 1 || i === 4
    const mouthRadius = isSidePocket
      ? SIDE_POCKET_MOUTH_RADIUS
      : CORNER_POCKET_MOUTH_RADIUS

    return Math.hypot(x - p.x, y - p.y) < mouthRadius
  })
}

export function shouldSink(ball: Ball) {
  return pockets.some((p, i) => {
    const isSidePocket = i === 1 || i === 4
    const sinkRadius = isSidePocket ? SIDE_POCKET_SINK_RADIUS : POCKET_SINK_RADIUS
    return Math.hypot(ball.x - p.x, ball.y - p.y) < sinkRadius
  })
}

function respotCueBall(balls: Ball[]) {
  const withoutCue = balls.filter((ball) => ball.id !== "cue")

  return [
    ...withoutCue,
    {
      id: "cue",
      x: CUE_START_X,
      y: CUE_START_Y,
      vx: 0,
      vy: 0,
      color: "white",
    },
  ]
}

export function resolveTurn(state: GameState): GameState {
  const shotPocketed = state.currentShotPocketed ?? []

  const cueMissing = !state.balls.some((b) => b.id === "cue")
  const cuePocketed = shotPocketed.includes("cue")

  const rackCleared = state.balls.every((b) => b.id === "cue")

  if (cuePocketed || cueMissing || rackCleared) {
    return {
      balls: createRack(),
      currentPlayer: "ai",
      gameOver: false,
      winner: null,
      lastShotPocketed: shotPocketed,
      currentShotPocketed: [],
      needsAiMove: true,
    }
  }

  return {
    ...state,
    currentPlayer: "ai",
    gameOver: false,
    winner: null,
    lastShotPocketed: shotPocketed,
    currentShotPocketed: [],
    needsAiMove: true,
  }
}

export function simulateShot(state: GameState, shot: Shot): GameState {
  let nextState: GameState = {
    ...state,
    balls: applyShot(state.balls, shot.angle, shot.power),
    currentShotPocketed: [],
  }

  const pocketed: string[] = []

  for (let i = 0; i < 600; i++) {
    const step = stepPhysics(nextState.balls)
    pocketed.push(...step.pocketed)
    nextState = { ...nextState, balls: step.balls }

    if (isAtRest(step.balls)) break
  }

  return resolveTurn({ ...nextState, currentShotPocketed: pocketed })
}
