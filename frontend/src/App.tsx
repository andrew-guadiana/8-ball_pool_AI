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
