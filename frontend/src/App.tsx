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
  onPointerDown?: () => void
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
        onPointerDown?.()
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

function App() {
  const [balls, setBalls] = useState<Ball[]>([
    { id: "cue", x: 100, y: 200, vx: 0, vy: 0, color: "white" },
    { id: "1", x: 300, y: 200, vx: 0, vy: 0, color: "yellow" },
  ])

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const lastPointer = useRef({ x: 0, y: 0})

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

  useEffect(() => {
    let frameId = 0

    const step = () => {
      setBalls((prev) =>
               prev.map((ball) => {
                 if (ball.id === draggingId) return ball
                   return {
                 ...ball,
                 x: ball.x + ball.vx,
                 y: ball.y + ball.vy,
                 vx: ball.vx * 0.99,
                 vy: ball.vy * 0.99,
               }
               })
                       )

                       frameId = requestAnimationFrame(step)
    }

    frameId = requestAnimationFrame(step)

    return () => cancelAnimationFrame(frameId)
  }, [draggingId])

  return (
    <div
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
          onPointerDown={() => {
            setDraggingId(ball.id)
          }}
        />
      ))}
    </div>
  )
}

export default App
