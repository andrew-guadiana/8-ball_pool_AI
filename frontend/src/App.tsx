import { useEffect, useRef, useState } from "react"
import { nearPocketMouth, shouldSink, resolveBallCollision, createRack, simulateShot, stepPhysics, isAtRest, } from "./game/engine"
import type { BallState, BallProps, PocketPosition, Player, StepResult, GameState, Shot } from "./game/types"
import { TABLE_W, TABLE_H, BALL_RADIUS, POCKET_VISUAL_DIAMETER, POCKET_VISUAL_RADIUS, pocketImages, pockets, } from "./game/constants"
import Ball from "./components/Ball"
import Pocket from "./components/Pocket"

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    balls: createRack(),
    currentPlayer: "human",
    gameOver: false,
    winner: null,
    currentShotPocketed: [],
  })

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
    if (!aiming || gameState.gameOver) return

      const dx = aimStart.current.x - aimCurrent.current.x
      const dy = aimStart.current.y - aimCurrent.current.y
      const angle = Math.atan2(dy, dx)
      const power = Math.hypot(dx, dy) * 0.3

      setGameState((prev) => simulateShot(prev, { angle, power }))
      setAiming(false)
  }



  const cue = gameState.balls.find((ball) => ball.id === "cue")
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
  const tipOffset = -20 - power * 200

  useEffect(() => {
    let frameId = 0

    const step = () => {
      setGameState((prev) => ({
        ...prev,
        balls: stepPhysics(prev.balls).balls,
      }))
      frameId = requestAnimationFrame(step)
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [])



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

    {gameState.balls.map((ball) => (
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
