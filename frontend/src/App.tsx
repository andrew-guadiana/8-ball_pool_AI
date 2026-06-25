import { useEffect, useRef, useState } from "react"

type Ball = {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  color: string
}

type BallProps = {
  id: string
  x: number
  y: number
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
}

type Pocket = {
  x: number
  y: number
}

const TABLE_W = 900
const TABLE_H = 500

const RAIL_LEFT = 58
const RAIL_TOP = 50
const RAIL_RIGHT = 60
const RAIL_BOTTOM = 55

const BALL_DIAMETER = 25
const BALL_RADIUS = BALL_DIAMETER / 2

const POCKET_VISUAL_DIAMETER = 35
const POCKET_VISUAL_RADIUS = POCKET_VISUAL_DIAMETER / 2

const pocketSinkRadius = 22
const sidePocketSinkRadius = 10
const cornerPocketMouthRadius = 25
const sidePocketMouthRadius = 20

const pocketImages: Record<string, string> = {
  cue: "/assets/balls/cue.png",
  "1": "/assets/balls/1.png",
  "2": "/assets/balls/2.png",
  "3": "/assets/balls/3.png",
  "4": "/assets/balls/4.png",
  "5": "/assets/balls/5.png",
  "6": "/assets/balls/6.png",
  "7": "/assets/balls/7.png",
  "8": "/assets/balls/8.png",
  "9": "/assets/balls/9.png",
  "10": "/assets/balls/10.png",
  "11": "/assets/balls/11.png",
  "12": "/assets/balls/12.png",
  "13": "/assets/balls/13.png",
  "14": "/assets/balls/14.png",
  "15": "/assets/balls/15.png",
}

const pockets: Pocket[] = [
  { x: 57, y: 44 },
  { x: TABLE_W / 2, y: 45 },
  { x: TABLE_W - 62, y: 43 },
  { x: 57, y: TABLE_H - 43 },
  { x: TABLE_W / 2, y: TABLE_H - 50 },
  { x: TABLE_W - 57, y: TABLE_H - 43 },
]

function nearPocketMouth(x: number, y: number) {
  return pockets.some((p, i) => {
    const isSidePocket = i === 1 || i === 4
    const mouthRadius = isSidePocket ? sidePocketMouthRadius : cornerPocketMouthRadius
    return Math.hypot(x - p.x, y - p.y) < mouthRadius
  })
}

function shouldSink(ball: Ball) {
  return pockets.some((p, i) => {
    const isSidePocket = i === 1 || i === 4
    const sinkRadius = isSidePocket ? sidePocketSinkRadius : pocketSinkRadius
    return Math.hypot(ball.x - p.x, ball.y - p.y) < sinkRadius
  })
}

function Ball({ id, x, y, onPointerDown }: BallProps) {
  return (
    <div
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onPointerDown?.(e)
      }}
      style={{
        position: "absolute",
        left: x - BALL_RADIUS,
        top: y - BALL_RADIUS,
        width: BALL_DIAMETER,
        height: BALL_DIAMETER,
        borderRadius: "50%",
        cursor: "grab",
        boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.4)",
      }}
    >
      <img
        src={pocketImages[id]}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    </div>
  )
}

function Pocket({ x, y }: Pocket) {
  return (
    <div
      style={{
        position: "absolute",
        left: x - POCKET_VISUAL_RADIUS,
        top: y - POCKET_VISUAL_RADIUS,
        width: POCKET_VISUAL_DIAMETER,
        height: POCKET_VISUAL_DIAMETER,
        borderRadius: "50%",
        zIndex: 0,
      }}
    />
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

export default function App() {
  const [balls, setBalls] = useState<Ball[]>(createRack())
  const [aiming, setAiming] = useState(false)

  const aimStart = useRef({ x: 0, y: 0 })
  const aimCurrent = useRef({ x: 0, y: 0 })
  const boardRef = useRef<HTMLDivElement>(null)

  const updateBallPosition = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!aiming) return

    const rect = e.currentTarget.getBoundingClientRect()
    aimCurrent.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const endDrag = () => {
    if (!aiming) return

    const dx = aimStart.current.x - aimCurrent.current.x
    const dy = aimStart.current.y - aimCurrent.current.y
    const power = 0.08

    setBalls((prev) =>
      prev.map((ball) =>
        ball.id === "cue" ? { ...ball, vx: dx * power, vy: dy * power } : ball
      )
    )

    setAiming(false)
  }

  const radius = BALL_RADIUS
  const width = TABLE_W
  const height = TABLE_H
  const friction = 0.985
  const stopSpeed = 0.03

  useEffect(() => {
    let frameId = 0

    const step = () => {
      setBalls((prev) => {
        let nextBalls = prev.map((ball) => {
          if (ball.id === "cue" && aiming) return ball

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

        nextBalls = nextBalls.filter((ball) => !shouldSink(ball))
        return nextBalls
      })

      frameId = requestAnimationFrame(step)
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [aiming])

  const cue = balls.find((ball) => ball.id === "cue")
  const cueCenter = cue ? { x: cue.x, y: cue.y } : { x: 0, y: 0 }

  const cueAngle = Math.atan2(
    cueCenter.y - aimCurrent.current.y,
    cueCenter.x - aimCurrent.current.x
  )

  const cueLength = 430

  const cuePull = Math.min(
    Math.hypot(
      aimCurrent.current.x - cueCenter.x,
      aimCurrent.current.y - cueCenter.y
    ),
    120
  )

  const power = cuePull / 120
  const tipOffset = -20 - power * 100

  return (
    <div
      ref={boardRef}
      onPointerMove={updateBallPosition}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      style={{
        width: TABLE_W,
        height: TABLE_H,
        position: "relative",
        margin: "80px auto",
        backgroundImage: "url('/assets/pool-table.png')",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      {pockets.map((p, i) => (
        <Pocket key={i} x={p.x} y={p.y} />
      ))}


      {aiming && (
  <img
    src="/assets/pool_stick.png"
    alt=""
    draggable={false}
    style={{
      position: "absolute",
      left: cueCenter.x,
      top: cueCenter.y,
      width: cueLength,          // adjust to your cue PNG
      height: "auto",
      pointerEvents: "none",
      userSelect: "none",
      zIndex: 9,
      transformOrigin: `${cueLength - tipOffset}px 50%`,
      transform: ` translate(-${cueLength - tipOffset}px, -50%) rotate(${cueAngle}rad) `,
    }}
  />
)}

      {balls.map((ball) => (
        <Ball
          key={ball.id}
          id={ball.id}
          x={ball.x}
          y={ball.y}
          onPointerDown={
            ball.id === "cue"
              ? (e) => {
                  const rect = boardRef.current?.getBoundingClientRect()
                  if (!rect) return

                  const x = e.clientX - rect.left
                  const y = e.clientY - rect.top

                  aimStart.current = { x, y }
                  aimCurrent.current = { x, y }
                  setAiming(true)
                }
              : undefined
          }
        />
      ))}
    </div>
  )
}
