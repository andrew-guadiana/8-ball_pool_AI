import { useCallback, useEffect, useRef, useState } from "react"
import { resolveTurn, applyShot, createRack, stepPhysics, isAtRest } from "./game/engine"
import type { GameState, Shot, TrainingStatus } from "./game/types"
import { TABLE_W, TABLE_H, pockets } from "./game/constants"
import Ball from "./components/Ball"
import Pocket from "./components/Pocket"
import { trainer } from "./ai/neuroevolution"

function freshGameState(): GameState {
  return {
    balls: createRack(),
    currentPlayer: "ai",
    gameOver: false,
    winner: null,
    lastShotPocketed: [],
    currentShotPocketed: [],
    needsAiMove: true,
  }
}

function hasCueBall(state: GameState) {
  return state.balls.some((b) => b.id === "cue")
}

function isValidShot(shot: Partial<Shot>): shot is Shot {
  return (
    typeof shot.angle === "number" &&
    Number.isFinite(shot.angle) &&
    typeof shot.power === "number" &&
    Number.isFinite(shot.power)
  )
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(freshGameState)
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null)

  const shotActiveRef = useRef(false)
  const aiBusyRef = useRef(false)
  const aiTimerRef = useRef<number | null>(null)

  const ballsRef = useRef<GameState["balls"]>(createRack())
  const pocketedRef = useRef<string[]>([])
  const gameStateRef = useRef<GameState>(freshGameState())

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    let alive = true

    const updateStatus = () => {
      if (!alive) return
      setTrainingStatus(trainer.getStatus())
    }

    updateStatus()
    const timer = window.setInterval(updateStatus, 500)

    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const getAiShot = useCallback(async (state: GameState): Promise<Shot & { candidates?: never[] }> => {
    return trainer.predictShot(state)
  }, [])

  const clearAiTimer = useCallback(() => {
    if (aiTimerRef.current !== null) {
      window.clearTimeout(aiTimerRef.current)
      aiTimerRef.current = null
    }
  }, [])

  const startAiMove = useCallback(
    async (state: GameState) => {
      if (aiBusyRef.current) return
      if (shotActiveRef.current) return
      if (state.gameOver) return
      if (state.currentPlayer !== "ai") return
      if (!state.needsAiMove) return
      if (!hasCueBall(state)) return

      aiBusyRef.current = true

      try {
        const shot = await getAiShot(state)

        if (!isValidShot(shot)) {
          throw new Error("AI returned an invalid shot")
        }

        const nextBalls = applyShot(state.balls, shot.angle, shot.power)

        ballsRef.current = nextBalls
        pocketedRef.current = []
        shotActiveRef.current = true

        const nextState: GameState = {
          ...state,
          balls: nextBalls,
          currentShotPocketed: [],
          needsAiMove: false,
        }

        gameStateRef.current = nextState
        setGameState(nextState)
      } catch (err) {
        console.error("startAiMove error", err)

        const nextState: GameState = {
          ...state,
          needsAiMove: true,
        }

        gameStateRef.current = nextState
        setGameState(nextState)
      } finally {
        aiBusyRef.current = false
      }
    },
    [getAiShot]
  )

  useEffect(() => {
    clearAiTimer()

    if (!gameState.needsAiMove) return
    if (shotActiveRef.current || aiBusyRef.current || gameState.gameOver) return
    if (gameState.currentPlayer !== "ai") return
    if (!hasCueBall(gameState)) return

    aiTimerRef.current = window.setTimeout(() => {
      void startAiMove(gameStateRef.current)
    }, 100)

    return clearAiTimer
  }, [gameState, startAiMove, clearAiTimer])

  useEffect(() => {
    let frameId = 0

    const step = () => {
      if (shotActiveRef.current) {
        const result = stepPhysics(ballsRef.current)
        ballsRef.current = result.balls
        pocketedRef.current = [...pocketedRef.current, ...result.pocketed]

        if (!isAtRest(result.balls)) {
          const nextState: GameState = {
            ...gameStateRef.current,
            balls: result.balls,
            currentShotPocketed: pocketedRef.current,
          }

          gameStateRef.current = nextState
          setGameState(nextState)
        } else {
          const resolved = resolveTurn({
            ...gameStateRef.current,
            balls: result.balls,
            currentShotPocketed: pocketedRef.current,
          })

          shotActiveRef.current = false
          pocketedRef.current = []
          ballsRef.current = resolved.balls

          const finalState: GameState = {
            ...resolved,
            needsAiMove: !resolved.gameOver && resolved.currentPlayer === "ai",
          }

          gameStateRef.current = finalState
          setGameState(finalState)

          trainer.trainOnSettledTurn(finalState)
        }
      }

      frameId = requestAnimationFrame(step)
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <>
      <div
        style={{
          textAlign: "center",
          fontSize: 28,
          fontWeight: "bold",
          marginTop: 20,
        }}
      >
        Generation {trainingStatus?.generation ?? 0}
      </div>

      <div
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

        {gameState.balls.map((ball) => (
          <Ball key={ball.id} id={ball.id} x={ball.x} y={ball.y} />
        ))}
      </div>
    </>
  )
}
