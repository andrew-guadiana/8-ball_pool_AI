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
  x: number
  y: number
  color: string
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
}

type Pocket = {
  x: number
  y: number
}

const pockets: Pocket[] = [
  {x: 0, y: 0},
  {x: 450, y: 0},
  {x: 900, y: 0},
  {x: 0, y: 500},
  {x: 450, y: 500},
  {x: 900, y: 500},
]

const pocketOpeningsX = [450]
const pocketOpeningsY = [225, 275]
const pocketCutout = 45

function nearAnyPocketX(y: number) {
  return pockets.some((p) => Math.abs(p.y - y) < pocketCutout)
}
function nearAnyPocketY(x: number) {
  return pockets.some((p) => Math.abs(p.x - x) < pocketCutout)
}

function Ball({ x, y, color, onPointerDown }: BallProps) {
  return (
    <div
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onPointerDown?.(e)
      }}
      style={{
        position: "absolute",
        left: x - 15,
        top: y - 15,
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: color,
        border: "1px solid black",
        cursor: "grab",
      }}
    />
  )
}

function Pocket({ x, y }: Pocket) {
  return (
    <div 
    style={{
      position: "absolute",
      left: x - 18,
      top: y - 18,
      width: 36,
      height: 36,
      borderRadius: "50%",
      background: "black",
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

const pocketRadius = 22
const ballRadius = 15

function isInPocket(ball: Ball) {
  return pockets.some((p) => {
    const dx = ball.x - p.x
    const dy = ball.y - p.y
    return Math.hypot(dx, dy) < pocketRadius
  })
}

function App() {

  const BALL_R = 15
  const BALL_GAP = 1
  const ROW_SPACING = (BALL_R * 2 + BALL_GAP) * 0.87
  const COL_SPACING = BALL_R * 2 + BALL_GAP 

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

  function createRack() {
    const balls: Ball[] = [
      { id: "cue", x: 120, y: 250, vx: 0, vy: 0, color: "white" },
    ]

    const startX = 650
    const startY = 250

    let n = 1

    for (let row = 0; row < 5; row++) {
      for (let i = 0; i <= row; i++) {
        balls.push({
          id: String(n),
          x: startX + row * COL_SPACING,
          y: startY - (row * BALL_R) + i * (BALL_R * 2),
          vx: 0,
          vy: 0,
          color: objectBallColors[String(n)] ?? "gray",
        })
        n++
      }
    }

    return balls
  }

  const [balls, setBalls] = useState<Ball[]>(createRack())

  const [aiming, setAiming] = useState(false)
  const aimStart = useRef({ x: 0, y: 0})
  const aimCurrent = useRef({ x: 0, y: 0})

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
                      ball.id === "cue"
                      ? { ...ball, vx: dx * power, vy: dy * power, }
                      : ball
                     )
            )
      setAiming(false)
  }

  const radius = 15
  const width = 900
  const height = 500
  const friction = 0.985

  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frameId = 0

    const step = () => {
      setBalls((prev) => {
        let nextBalls = prev.map((ball) => {
                 if (ball.id === "cue" && aiming) return ball

                  let nextX = ball.x + ball.vx
                  let nextY = ball.y + ball.vy

                  const stopSpeed = 0.03

                  let nextVx = ball.vx * friction
                  let nextVy = ball.vy * friction

                  if (Math.abs(nextVx) < stopSpeed) nextVx = 0
                  if (Math.abs(nextVy) < stopSpeed) nextVy = 0

                  if (nextX < radius) {
                    if (!nearAnyPocketX(nextY)) {
                      nextX = radius
                      nextVx *= -1
                    }
                  } else if (nextX > width - radius) {
                    if (!nearAnyPocketX(nextY)) {
                      nextX = width - radius
                      nextVx *= -1
                    }
                  } 

                  if (nextY < radius) {
                    if (!nearAnyPocketY(nextX)) {
                      nextY = radius
                      nextVy *= -1
                    }
                  } else if (nextY > height - radius) {
                    if (!nearAnyPocketY(nextX)) {
                      nextY = height - radius
                      nextVy *= -1
                    }
                  }

                  return { ...ball, x: nextX, y: nextY, vx: nextVx, vy: nextVy, }
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

               nextBalls = nextBalls.filter((ball) => !isInPocket(ball))
               return nextBalls
    })
    frameId = requestAnimationFrame(step)
  }

    frameId = requestAnimationFrame(step)

    return () => cancelAnimationFrame(frameId)
  }, [aiming])

  const cuePos = balls.find((ball) => ball.id === "cue")
  const cueCenter = cuePos ? { x: cuePos.x, y: cuePos.y } : { x: 0, y: 0 }
  return (
    <div
    ref={boardRef}
      onPointerMove={updateBallPosition}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      style={{
        width: 900,
        height: 500,
        position: "relative",
        background: "green",
        margin: "80px auto",
        overflow: "hidden",
      }}
    >
    {pockets.map((p, i) => (
      <Pocket key={i} x={p.x} y={p.y} />
    ))}


    {aiming && (
      <div
      style={{
        position: "absolute",
        left: cueCenter.x,
        top: cueCenter.y,
        width: Math.hypot( aimCurrent.current.x - aimStart.current.x, aimCurrent.current.y - aimStart.current.y),
        height: 4,
        background: "white",
        transformOrigin: "0 0",
        transform: `rotate(${Math.atan2(
          cueCenter.y - aimCurrent.current.y,
          cueCenter.x - aimCurrent.current.x
        )}rad)`,
        pointerEvents: "none",
        zIndex: 10,
      }}
      />
    )}

      {balls.map((ball) => (
        <Ball
          key={ball.id}
          x={ball.x}
          y={ball.y}
          color={ball.color}
          onPointerDown={ball.id === "cue" ? (e) => {
            const rect = boardRef.current?.getBoundingClientRect()
            if (!rect) return

              const x = e.clientX - rect.left
              const y = e.clientY - rect.top

            aimStart.current = { x, y }
            aimCurrent.current = { x, y }
            setAiming(true)
          } : undefined}
        />
      ))}
    </div>
  )
}

export default App
