import { useState } from "react"

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
      left: x,
      top: y,
      width: 30,
      height: 30,
      borderRadius: "50%",
      background: color,
    }}
    />
  )
}

function App() {
  const [balls] = useState<Ball[]>([
    {
    id: "cue",
    x: 100,
    y: 200,
    color: "white",
  },
  ])


return (
  <div
  style={{
    width: 900,
    height: 500,
    background: "green",
    position: "relative",
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
