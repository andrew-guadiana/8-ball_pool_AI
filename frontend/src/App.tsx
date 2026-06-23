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
}

function Ball({ x, y, color }: BallProps) {
  return (
    <div
    style={{
      position: "absolute",
      left: x - 15,
      top: y - 15,
      width: 30,
      height: 30,
      borderRadius: "50%",
      background: color,
    }}
    />
  )
}

function App() {
  const [balls, setBalls] = useState<Ball[]>([
    {
    id: "cue",
    x: 100,
    y: 200,
    color: "white",
  },
  ])


return (
  <div
  onClick={(e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setBalls([
      {
        id: "cue",
        x, 
        y,
        color: "white",
      },
    ])
  }}
  style={{
    width: 900,
    height: 500,
    position: "absolute", left: "center", top: "30%",
    background: "green",
  }}>
  {balls.map(ball => (
    <Ball 
    key={ball.id}
    x={ball.x}
    y={ball.y}
    color={ball.color}
    />
  ))}
  </div>
)
}

export default App
