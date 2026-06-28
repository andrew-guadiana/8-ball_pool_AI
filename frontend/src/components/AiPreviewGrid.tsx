import { memo, useEffect, useMemo, useState } from "react"
import { TABLE_W, TABLE_H, pockets } from "../game/constants"
import { simulateShotFrames } from "../game/preview"
import type { Ball } from "../game/types"

type CandidateShot = {
  angle: number
  power: number
  fitness: number
  target_id?: string | null
}

type Props = {
  balls: Ball[]
  candidates: CandidateShot[]
}

type Preview = {
  candidate: CandidateShot
  frames: Ball[][]
}

export default function AiPreviewGrid({ balls, candidates }: Props) {
  const previews = useMemo<Preview[]>(() => {
    return candidates.slice(0, 3).map((candidate) => ({
      candidate,
      frames: simulateShotFrames(balls, {
        angle: candidate.angle,
        power: candidate.power,
      }),
    }))
  }, [balls, candidates])

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
        marginTop: 16,
      }}
    >
      {previews.map((p, i) => (
        <MiniTable
          key={`${p.candidate.target_id ?? "cand"}-${i}`}
          preview={p}
        />
      ))}
    </div>
  )
}

const MiniTable = memo(function MiniTable({ preview }: { preview: Preview }) {
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    setFrameIndex(0)
    if (preview.frames.length <= 1) return

    let timer: number | undefined

    const tick = () => {
      setFrameIndex((idx) => {
        if (idx >= preview.frames.length - 1) {
          if (timer !== undefined) window.clearInterval(timer)
          return idx
        }
        return idx + 1
      })
    }

    timer = window.setInterval(tick, 100)
    return () => {
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [preview.frames])

  const balls = preview.frames[Math.min(frameIndex, preview.frames.length - 1)] ?? []

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 12,
        padding: 8,
        background: "rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontSize: 12, marginBottom: 6, color: "white" }}>
        fitness {preview.candidate.fitness.toFixed(1)} | power{" "}
        {preview.candidate.power.toFixed(1)}
      </div>

      <div
        style={{
          width: "100%",
          aspectRatio: `${TABLE_W} / ${TABLE_H}`,
          position: "relative",
          overflow: "hidden",
          backgroundImage: "url('/assets/pool-table.png')",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          borderRadius: 10,
        }}
      >
        {pockets.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(p.x / TABLE_W) * 100}%`,
              top: `${(p.y / TABLE_H) * 100}%`,
              width: 10,
              height: 10,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(0,0,0,0.75)",
            }}
          />
        ))}

        {balls.map((ball) => (
          <div
            key={ball.id}
            style={{
              position: "absolute",
              left: `${(ball.x / TABLE_W) * 100}%`,
              top: `${(ball.y / TABLE_H) * 100}%`,
              transform: "translate(-50%, -50%)",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.95)",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
            }}
          />
        ))}
      </div>
    </div>
  )
})
