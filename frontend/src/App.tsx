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
  const [balls, setBalls] = useState<Ball[]>([
    { id: "cue", x: 100, y: 200, vx: 0, vy: 0, color: "white" },
    { id: "1", x: 300, y: 200, vx: 0, vy: 0, color: "yellow" },
  ])

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const lastPointer = useRef({ x: 0, y: 0})
  const boardRef = useRef<HTMLDivElement>(null)

  const updateBallPosition = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const dx = x - lastPointer.current.x
    const dy = y - lastPointer.current.y

    lastPointer.current = { x, y }

    setBalls((prev) =>
             prev.map((ball) => 
               ball.id === draggingId ? { ...ball, x, y, vx: dx * 0.2, vy: dy * 0.2 } : ball
             )
            )
  }

  const endDrag = () => {
    if (!draggingId) return
      setDraggingId(null)
  }

  const radius = 15
  const width = 900
  const height = 500
  const friction = 0.985

  useEffect(() => {
    let frameId = 0

    const step = () => {
      setBalls((prev) => {
        let nextBalls = prev.map((ball) => {
                 if (ball.id === draggingId) return ball

                  let nextX = ball.x + ball.vx
                  let nextY = ball.y + ball.vy

                  let nextVx = ball.vx * friction
                  let nextVy = ball.vy * friction

                  if (nextX < radius) {
                    nextX = radius
                    nextVx *= -1
                  } else if (nextX > width - radius) {
                    nextX = width - radius
                    nextVx *= -1
                  } 

                  if (nextY < radius) {
                    nextY = radius
                    nextVy *= -1
                  } else if (nextY > height - radius) {
                    nextY = height - radius
                    nextVy *= -1
                  }

                  return {
                    ...ball,
                    x: nextX,
                    y: nextY,
                    vx: nextVx,
                    vy: nextVy,
                  }
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
  }, [draggingId])

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

      {balls.map((ball) => (
        <Ball
          key={ball.id}
          x={ball.x}
          y={ball.y}
          color={ball.color}
          onPointerDown={(e) => {
            const rect = boardRef.current?.getBoundingClientRect()
            if (!rect) return

            lastPointer.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            }
            setDraggingId(ball.id)
          }}
        />
      ))}
    </div>
  )
}

export default App
