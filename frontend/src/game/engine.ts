import { TABLE_W, TABLE_H, RAIL_LEFT, RAIL_TOP, RAIL_RIGHT, RAIL_BOTTOM, 
  BALL_RADIUS, BALL_DIAMETER, POCKET_SINK_RADIUS, SIDE_POCKET_SINK_RADIUS, 
  CORNER_POCKET_MOUTH_RADIUS, SIDE_POCKET_MOUTH_RADIUS, pockets, } from "./constants"

function stepPhysics(balls: Ball[]): StepResult {
  const radius = BALL_RADIUS
  const width = TABLE_W
  const height = TABLE_H
  const friction = 0.985
  const stopSpeed = 0.03

  let pocketed: string[] = []

  let nextBalls = balls.map((ball) => {
    let nextX = ball.x + ball.vx
    let nextY = ball.y + ball.vy

    let nextVx = ball.vx * friction
    let nextVy = ball.vy * friction

    if (Math.hypot(nextVx, nextVy) < stopSpeed) {
      nextVx = 0
      nextVy = 0
    }

    const leftBound = RAIL_LEFT + radius
    const rightBound = width - RAIL_RIGHT - radius
    const topBound = RAIL_TOP + radius
    const bottomBound = height - RAIL_BOTTOM - radius

    if (nextX < leftBound) {
      if (!nearPocketMouth(nextX, nextY)) {
        nextX = leftBound
        nextVx *= -1
      }
    } else if (nextX > rightBound) {
      if (!nearPocketMouth(nextX, nextY)) {
        nextX = rightBound
        nextVx *= -1
      }
    }

    if (nextY < topBound) {
      if (!nearPocketMouth(nextX, nextY)) {
        nextY = topBound
        nextVy *= -1
      }
    } else if (nextY > bottomBound) {
      if (!nearPocketMouth(nextX, nextY)) {
        nextY = bottomBound
        nextVy *= -1
      }
    }

    return { ...ball, x: nextX, y: nextY, vx: nextVx, vy: nextVy }
  })

  for (let i = 0; i < nextBalls.length; i++) {
    for (let j = i + 1; j < nextBalls.length; j++) {
      const collision = resolveBallCollision(nextBalls[i], nextBalls[j], radius)
      if (collision) {
        nextBalls[i] = collision[0]
        nextBalls[j] = collision[1]
      }
    }
  }

  const kept: Ball[] = []
  for (const ball of nextBalls) {
    if (shouldSink(ball)) {
      pocketed.push(ball.id)
    } else  {
      kept.push(ball)
    }
  }

  return { balls: kept, pocketed }
}

function isAtRest(balls: Ball[]) {
  return balls.every((ball) => Math.hypot(ball.vx, ball.vy) < 0.01)
}

function applyShot(balls: Ball[], angle: number, power: number): Ball[] {
  return balls.map((ball) => 
                   ball.id === "cue" ? {...ball, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power} : ball
                  )
}

function resolveTurn(state: GameState): GameState {
  const cuePocketed = state.currentShotPocketed.includes("cue")
  const eightPocketed = state.currentShotPocketed.includes("8")
  const otherBallsLeft = state.balls.some((b) => b.id !== "cue" && b.id !== "8")

  if (eightPocketed && otherBallsLeft) {
    return {
      ...state,
      gameOver: true,
      winner: state.currentPlayer === "human" ? "ai" : "human",
    }
  }

  if (cuePocketed) {
    return {
      ...state,
      balls: respotCueBall(state.balls),
      currentPlayer: state.currentPlayer === "human" ? "ai" : "human",
      lastShotPocketed: state.currentShotPocketed,
      currentShotPocketed: [],
      gameOver: state.gameOver,
      winner: state.winner,
    }
  }

  return {
    ...state,
    currentPlayer: state.currentPlayer === "human" ? "ai" : "human",
    lastShotPocketed: state.currentShotPocketed,
    currentShotPocketed: [],
  }
}

function simulateShot(state: GameState, shot: Shot): GameState {
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



function respotCueBall(balls: Ball[]) {
  return balls.map((ball) =>
                   ball.id === "cue"
                     ? {...ball, x: 120, y: 250, vx: 0, vy: 0}
                     :ball
                  )
}

function resolveBallCollision(a: Ball, b: Ball, radius: number) {
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

      const aVx = a.vx + (bSpeed - aSpeed) * nx
      const aVy = a.vy + (bSpeed - aSpeed) * ny
      const bVx = b.vx + (aSpeed - bSpeed) * nx
      const bVy = b.vy + (aSpeed - bSpeed) * ny

      return [
        { ...aNext, vx: aVx, vy: aVy },
        { ...bNext, vx: bVx, vy: bVy },
      ] as const
}

function createRack(): Ball[] {
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

  const balls: Ball[] = [
    { id: "cue", x: 120, y: 250, vx: 0, vy: 0, color: "white" },
  ]

  const startX = 650
  const startY = 250
  const ballGap = 1
  const spacing = BALL_DIAMETER + ballGap

  let n = 1

  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      balls.push({
        id: String(n),
        x: startX + row * spacing * 0.87,
        y: startY - row * (BALL_RADIUS - 1) + i * spacing,
        vx: 0,
        vy: 0,
        color: objectBallColors[String(n)] ?? "gray",
      })
      n++
    }
  }

  return balls
}

function nearPocketMouth(x: number, y: number) {
  return pockets.some((p, i) => {
    const isSidePocket = i === 1 || i === 4
    const mouthRadius = isSidePocket ? SIDE_POCKET_MOUTH_RADIUS : CORNER_POCKET_MOUTH_RADIUS
    return Math.hypot(x - p.x, y - p.y) < mouthRadius
  })
}

function shouldSink(ball: Ball) {
  return pockets.some((p, i) => {
    const isSidePocket = i === 1 || i === 4
    const sinkRadius = isSidePocket ? SIDE_POCKET_SINK_RADIUS : POCKET_SINK_RADIUS
    return Math.hypot(ball.x - p.x, ball.y - p.y) < sinkRadius
  })
}

export {
  createRack,
  stepPhysics,
  isAtRest,
  simulateShot,
  resolveTurn,
  respotCueBall,
  resolveBallCollision,
  nearPocketMouth,
  shouldSink,
  TABLE_W,
}
