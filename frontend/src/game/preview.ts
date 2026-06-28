import { applyShot, stepPhysics, isAtRest } from "./engine"
import type { Ball, Shot } from "./types"

export function simulateShotFrames(
  balls: Ball[],
  shot: Shot,
  maxFrames = 140
): Ball[][] {
  let current = applyShot(balls, shot.angle, shot.power)
  const frames: Ball[][] = [current.map((b) => ({ ...b }))]

  for (let i = 0; i < maxFrames; i++) {
    const step = stepPhysics(current)
    current = step.balls
    frames.push(current.map((b) => ({ ...b })))
    if (isAtRest(current)) break
  }

  return frames
}
