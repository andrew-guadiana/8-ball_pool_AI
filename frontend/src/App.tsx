import { useCallback, useEffect, useRef, useState } from "react"
import { resolveTurn, applyShot, createRack, stepPhysics, isAtRest } from "./game/engine"
import type { GameState, Shot, TrainingStatus } from "./game/types"
import { TABLE_W, TABLE_H, pockets } from "./game/constants"
import Ball from "./components/Ball"
import Pocket from "./components/Pocket"
import AiPreviewGrid from "./components/AiPreviewGrid"
import { trainer, type CandidateShot } from "./ai/neuroevolution"

function cloneBalls(balls: GameState["balls"]) {
  return balls.map((ball) => ({ ...ball }))
}

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
  const [candidates, setCandidates] = useState<CandidateShot[]>([])
  const [previewBalls, setPreviewBalls] = useState<GameState["balls"]>([])
  const [previewActive, setPreviewActive] = useState(false)
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null)

  const shotActiveRef = useRef(false)
  const aiBusyRef = useRef(false)
  const aiTimerRef = useRef<number | null>(null)

  // Single source of truth for physics between frames.
  const ballsRef = useRef<GameState["balls"]>(createRack())
  const pocketedRef = useRef<string[]>([])

  // Keep the latest React state available to RAF / timers without stale closures.
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

  const getAiShot = useCallback(async (state: GameState): Promise<Shot & { candidates?: CandidateShot[] }> => {
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
      console.log("startAiMove called", {
        currentPlayer: state.currentPlayer,
        gameOver: state.gameOver,
        shotActive: shotActiveRef.current,
        aiBusy: aiBusyRef.current,
        balls: state.balls.map((b) => b.id),
      })

      if (aiBusyRef.current) return
      if (shotActiveRef.current) return
      if (state.gameOver) return
      if (state.currentPlayer !== "ai") return
      if (!state.needsAiMove) return
      if (!hasCueBall(state)) {
        console.log("blocked: no cue ball in state", state.balls.map((b) => b.id))
        return
      }

      aiBusyRef.current = true

      try {
        const shot = await getAiShot(state)
        console.log("AI shot returned", shot)

        if (!isValidShot(shot)) {
          throw new Error("AI returned an invalid shot")
        }

        const nextCandidates = (shot.candidates ?? []).slice(0, 3)
        setCandidates(nextCandidates)
        setPreviewBalls(cloneBalls(state.balls))
        setPreviewActive(nextCandidates.length > 0)

        const nextBalls = applyShot(state.balls, shot.angle, shot.power)

        // Commit immediately to both React state and physics ref.
        ballsRef.current = nextBalls
        pocketedRef.current = []
        shotActiveRef.current = true

        setGameState((prev) => {
          const nextState: GameState = {
            ...prev,
            balls: nextBalls,
            currentShotPocketed: [],
            needsAiMove: false,
          }
          gameStateRef.current = nextState
          return nextState
        })
      } catch (err) {
        console.error("startAiMove error", err)
        setGameState((prev) => {
          const nextState = { ...prev, needsAiMove: true }
          gameStateRef.current = nextState
          return nextState
        })
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
      const currentState = gameStateRef.current
      trainer.recordState(currentState)

      if (shotActiveRef.current) {
        const result = stepPhysics(ballsRef.current)
        ballsRef.current = result.balls
        pocketedRef.current = [...pocketedRef.current, ...result.pocketed]

        setGameState((prev) => {
          const nextState: GameState = {
            ...prev,
            balls: result.balls,
            currentShotPocketed: pocketedRef.current,
          }

          if (!isAtRest(result.balls)) {
            gameStateRef.current = nextState
            return nextState
          }

          const resolved = resolveTurn(nextState)
          shotActiveRef.current = false
          pocketedRef.current = []

          setCandidates([])
          setPreviewBalls([])
          setPreviewActive(false)

          ballsRef.current = resolved.balls

          const finalState: GameState = {
            ...resolved,
            needsAiMove: !resolved.gameOver && resolved.currentPlayer === "ai",
          }

          gameStateRef.current = finalState
          return finalState
        })
      }

      frameId = requestAnimationFrame(step)
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    const stopSignal = { stopped: false }
    trainer.trainLoop(stopSignal)

    return () => {
      stopSignal.stopped = true
    }
  }, [])

  return (
    <>
      <div>
        <h1>Generation: {trainingStatus?.generation ?? 0}</h1>
        <p>Best score: {trainingStatus?.best_score?.toFixed(2) ?? "0.00"}</p>
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

      {previewActive && previewBalls.length > 0 && candidates.length > 0 && (
        <div style={{ width: TABLE_W, margin: "0 auto 24px auto" }}>
          <AiPreviewGrid balls={previewBalls} candidates={candidates} />
        </div>
      )}
    </>
  )
}
