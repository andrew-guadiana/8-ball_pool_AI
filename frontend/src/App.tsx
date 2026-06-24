import { useState } from "react"

type Ball = {
  id: string
  x: number
  y: number
  color: string
}

type BallProps = {
  x: number
  y: number
  color: string
  onPointerDown?: () => void
}

function Ball({ x, y, color, onPointerDown }: BallProps) {
  return (
    <div
      onPointerDown={onPointerDown}
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

function App() {
  const [balls, setBalls] = useState<Ball[]>([
    { id: "cue", x: 100, y: 200, color: "white" },
    { id: "1", x: 300, y: 200, color: "yellow" },
  ])

  const [draggingId, setDraggingId] = useState<string | null>(null)

  const updateBallPosition = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setBalls((prev) =>
      prev.map((ball) =>
        ball.id === draggingId ? { ...ball, x, y } : ball
      )
    )
  }

  return (
    <div
      onPointerMove={updateBallPosition}
      onPointerUp={() => setDraggingId(null)}
      onPointerLeave={() => setDraggingId(null)}
      style={{
        width: 900,
        height: 500,
        position: "relative",
        background: "green",
        margin: "80px auto",
      }}
    >
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
