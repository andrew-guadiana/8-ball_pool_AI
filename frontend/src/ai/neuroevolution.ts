import { applyShot, resolveTurn, stepPhysics, isAtRest } from "../game/engine"
import { TABLE_W, TABLE_H, pockets } from "../game/constants"
import type { GameState, Shot, TrainingStatus } from "../game/types"

export type CandidateShot = {
  angle: number
  power: number
  fitness: number
  target_id?: string | null
}

type Genome = {
  id: string
  w1: Float32Array
  b1: Float32Array
  w2: Float32Array
  b2: Float32Array
  fitness: number
}

type EvalResult = {
  fitness: number
  shot: Shot
}

const INPUTS = 34
const HIDDEN = 24
const OUTPUTS = 2

const POP_SIZE = 72
const ELITE_COUNT = 8
const MUTATION_RATE = 0.15
const MUTATION_SCALE = 0.35
const MAX_POWER = 60
const MIN_POWER = 8

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function randn() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x))
}

function tanh(x: number) {
  return Math.tanh(x)
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    balls: state.balls.map((b) => ({ ...b })),
    lastShotPocketed: [...state.lastShotPocketed],
    currentShotPocketed: [...state.currentShotPocketed],
  }
}

function makeGenome(): Genome {
  return {
    id: crypto.randomUUID(),
    w1: Float32Array.from({ length: INPUTS * HIDDEN }, () => randRange(-1, 1)),
    b1: Float32Array.from({ length: HIDDEN }, () => randRange(-0.5, 0.5)),
    w2: Float32Array.from({ length: HIDDEN * OUTPUTS }, () => randRange(-1, 1)),
    b2: Float32Array.from({ length: OUTPUTS }, () => randRange(-0.5, 0.5)),
    fitness: -Infinity,
  }
}

function crossover(a: Genome, b: Genome): Genome {
  const child = makeGenome()

  for (let i = 0; i < child.w1.length; i++) child.w1[i] = Math.random() < 0.5 ? a.w1[i] : b.w1[i]
  for (let i = 0; i < child.b1.length; i++) child.b1[i] = Math.random() < 0.5 ? a.b1[i] : b.b1[i]
  for (let i = 0; i < child.w2.length; i++) child.w2[i] = Math.random() < 0.5 ? a.w2[i] : b.w2[i]
  for (let i = 0; i < child.b2.length; i++) child.b2[i] = Math.random() < 0.5 ? a.b2[i] : b.b2[i]

  return child
}

function mutate(g: Genome) {
  const mutateArray = (arr: Float32Array) => {
    for (let i = 0; i < arr.length; i++) {
      if (Math.random() < MUTATION_RATE) {
        arr[i] += randn() * MUTATION_SCALE
      }
    }
  }

  mutateArray(g.w1)
  mutateArray(g.b1)
  mutateArray(g.w2)
  mutateArray(g.b2)
}

function forward(genome: Genome, inputs: number[]): number[] {
  const hidden = new Array<number>(HIDDEN).fill(0)
  const outputs = new Array<number>(OUTPUTS).fill(0)

  for (let h = 0; h < HIDDEN; h++) {
    let sum = genome.b1[h]
    for (let i = 0; i < INPUTS; i++) sum += inputs[i] * genome.w1[i * HIDDEN + h]
    hidden[h] = tanh(sum)
  }

  for (let o = 0; o < OUTPUTS; o++) {
    let sum = genome.b2[o]
    for (let h = 0; h < HIDDEN; h++) sum += hidden[h] * genome.w2[h * OUTPUTS + o]
    outputs[o] = sigmoid(sum)
  }

  return outputs
}

function cueBall(state: GameState) {
  return state.balls.find((b) => b.id === "cue") ?? null
}

function objectBalls(state: GameState) {
  return state.balls.filter((b) => b.id !== "cue")
}

function nearestObjects(state: GameState, count = 6) {
  const cue = cueBall(state)
  if (!cue) return []

  return objectBalls(state)
    .map((b) => {
      const dx = b.x - cue.x
      const dy = b.y - cue.y
      return {
        ball: b,
        dx,
        dy,
        dist: Math.hypot(dx, dy),
      }
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
}

function encodeState(state: GameState): number[] {
  const cue = cueBall(state)

  const inputs: number[] = []

  // cue ball
  if (cue) {
    inputs.push(cue.x / TABLE_W)
    inputs.push(cue.y / TABLE_H)
    inputs.push(clamp(cue.vx / 25, -1, 1))
    inputs.push(clamp(cue.vy / 25, -1, 1))
  } else {
    inputs.push(0, 0, 0, 0)
  }

  // object ball count
  inputs.push(objectBalls(state).length / 15)

  // cue-to-pocket geometry
  if (cue) {
    for (const p of pockets) {
      const dx = p.x - cue.x
      const dy = p.y - cue.y
      inputs.push(clamp(dx / TABLE_W, -1, 1))
      inputs.push(clamp(dy / TABLE_H, -1, 1))
      inputs.push(clamp(Math.hypot(dx, dy) / Math.hypot(TABLE_W, TABLE_H), 0, 1))
    }
  } else {
    for (let i = 0; i < pockets.length * 3; i++) inputs.push(0)
  }

  // nearest balls
  const near = nearestObjects(state, 6)
  for (let i = 0; i < 6; i++) {
    const item = near[i]
    if (!item || !cue) {
      inputs.push(0, 0, 1, 0)
      continue
    }

    inputs.push(clamp(item.dx / TABLE_W, -1, 1))
    inputs.push(clamp(item.dy / TABLE_H, -1, 1))
    inputs.push(clamp(item.dist / Math.hypot(TABLE_W, TABLE_H), 0, 1))

    const angle = Math.atan2(item.dy, item.dx) / Math.PI
    inputs.push(angle)
  }

  // pocket cluster pressure
  for (const p of pockets) {
    const ballsNearPocket = objectBalls(state).filter((b) => Math.hypot(b.x - p.x, b.y - p.y) < 80).length
    inputs.push(clamp(ballsNearPocket / 3, 0, 1))
  }

  // fill to INPUTS
  while (inputs.length < INPUTS) inputs.push(0)
  return inputs.slice(0, INPUTS)
}

function simulateShot(state: GameState, shot: Shot): GameState {
  const shotBalls = applyShot(state.balls, shot.angle, shot.power)

  let simBalls = shotBalls
  let pocketed: string[] = []
  for (let i = 0; i < 240; i++) {
    const result = stepPhysics(simBalls)
    simBalls = result.balls
    pocketed = pocketed.concat(result.pocketed)
    if (isAtRest(simBalls)) break
  }

  const afterShot: GameState = {
    ...state,
    balls: simBalls,
    currentShotPocketed: pocketed,
    lastShotPocketed: state.lastShotPocketed,
    gameOver: false,
    winner: null,
    currentPlayer: "ai",
    needsAiMove: false,
  }

  return resolveTurn(afterShot)
}

function evaluateGenome(genome: Genome, state: GameState): EvalResult {
  const inputs = encodeState(state)
  const out = forward(genome, inputs)

  const angle = out[0] * Math.PI * 2
  const power = MIN_POWER + out[1] * (MAX_POWER - MIN_POWER)

  const shot: Shot = { angle, power }

  const beforeObjects = objectBalls(state).length
  const beforeHasCue = !!cueBall(state)

  const resolved = simulateShot(state, shot)
  const afterObjects = objectBalls(resolved).length

  const pocketedCount = (state.currentShotPocketed?.length ?? 0) + (beforeObjects - afterObjects)
  const removedBalls = beforeObjects - afterObjects
  const cueStillAlive = !!cueBall(resolved)

  let fitness = 0

  fitness += removedBalls * 180
  fitness += pocketedCount * 60

  if (!cueStillAlive && beforeHasCue) fitness -= 250
  if (resolved.gameOver && resolved.winner === "ai") fitness += 500
  if (resolved.gameOver && resolved.winner === "human") fitness -= 250

  const movedSomething = resolved.balls.some((b) => Math.abs(b.vx) > 0.01 || Math.abs(b.vy) > 0.01)
  if (!movedSomething) fitness -= 80

  const cue = cueBall(state)
  if (cue) {
    // small bias toward shots that are at least pointing at something useful
    const near = nearestObjects(state, 1)[0]
    if (near) {
      const shotDir = { x: Math.cos(angle), y: Math.sin(angle) }
      const toBall = { x: near.dx / (near.dist || 1), y: near.dy / (near.dist || 1) }
      const alignment = shotDir.x * toBall.x + shotDir.y * toBall.y
      fitness += alignment * 25
    }
  }

  return { fitness, shot }
}

function pickBest<T extends { fitness: number }>(items: T[]) {
  return items.slice().sort((a, b) => b.fitness - a.fitness)
}

function topUniqueCandidates(results: Array<EvalResult & { target_id?: string | null }>, limit = 8): CandidateShot[] {
  const sorted = pickBest(results)
  const out: CandidateShot[] = []
  const seen = new Set<string>()

  for (const item of sorted) {
    const key = `${item.shot.angle.toFixed(3)}:${item.shot.power.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      angle: item.shot.angle,
      power: item.shot.power,
      fitness: item.fitness,
      target_id: item.target_id ?? null,
    })
    if (out.length >= limit) break
  }

  return out
}

export class NeuroEvoTrainer {
  private population: Genome[]
  private champion: Genome | null = null
  private recentStates: GameState[] = []
  generation = 0
  bestScore = -Infinity
  championPath = "local-typescript"

  constructor(popSize = POP_SIZE) {
    this.population = Array.from({ length: popSize }, () => makeGenome())
  }

  recordState(state: GameState) {
    this.recentStates.push(cloneState(state))
    if (this.recentStates.length > 24) this.recentStates.shift()
  }

  getStatus(): TrainingStatus {
    return {
      generation: this.generation,
      best_score: this.bestScore,
      champion_path: this.championPath,
      updated_at: Date.now() / 1000,
    }
  }

  predictShot(state: GameState): Shot & { candidates: CandidateShot[] } {
    const genome = this.champion ?? this.population[0]
    const baseInputs = encodeState(state)
    const baseOut = forward(genome, baseInputs)

    const baseShot: Shot = {
      angle: baseOut[0] * Math.PI * 2,
      power: MIN_POWER + baseOut[1] * (MAX_POWER - MIN_POWER),
    }

    const candidates: Array<EvalResult & { target_id?: string | null }> = []
    candidates.push({ ...evaluateGenome(genome, state), target_id: null })

    // mutate around the champion to produce preview candidates
    for (let i = 0; i < 10; i++) {
      const probe = makeGenome()
      probe.w1.set(genome.w1)
      probe.b1.set(genome.b1)
      probe.w2.set(genome.w2)
      probe.b2.set(genome.b2)
      mutate(probe)
      const result = evaluateGenome(probe, state)
      candidates.push({ ...result, target_id: null })
    }

    const best = pickBest(candidates)[0]
    const unique = topUniqueCandidates(candidates, 6)

    return {
      angle: best?.shot.angle ?? baseShot.angle,
      power: best?.shot.power ?? baseShot.power,
      candidates: unique,
    }
  }

  trainStep() {
    if (this.recentStates.length === 0) return

    const samples = this.recentStates.slice(-6)
    const scored = this.population.map((genome) => {
      let fitness = 0
      for (const state of samples) {
        fitness += evaluateGenome(genome, state).fitness
      }
      genome.fitness = fitness / samples.length
      return genome
    })

    const ranked = pickBest(scored)

    if (ranked[0] && ranked[0].fitness > this.bestScore) {
      this.bestScore = ranked[0].fitness
      this.champion = {
        id: ranked[0].id,
        w1: new Float32Array(ranked[0].w1),
        b1: new Float32Array(ranked[0].b1),
        w2: new Float32Array(ranked[0].w2),
        b2: new Float32Array(ranked[0].b2),
        fitness: ranked[0].fitness,
      }
    }

    const elites = ranked.slice(0, ELITE_COUNT).map((g) => ({
      id: g.id,
      w1: new Float32Array(g.w1),
      b1: new Float32Array(g.b1),
      w2: new Float32Array(g.w2),
      b2: new Float32Array(g.b2),
      fitness: g.fitness,
    }))

    const next: Genome[] = elites

    while (next.length < this.population.length) {
      const a = elites[Math.floor(Math.random() * elites.length)]
      const b = elites[Math.floor(Math.random() * elites.length)]
      const child = crossover(a, b)
      mutate(child)
      next.push(child)
    }

    this.population = next
    this.generation += 1
  }

  trainLoop(stopSignal?: { stopped: boolean }) {
    const tick = () => {
      if (stopSignal?.stopped) return
      this.trainStep()
      setTimeout(tick, 0)
    }
    tick()
  }
}

export const trainer = new NeuroEvoTrainer()
