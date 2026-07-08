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

const OBJECT_SLOTS = 15
const INPUTS = 40
const HIDDEN = 32
const OUTPUTS = 2

const POP_SIZE = 36
const ELITE_COUNT = 6
const MUTATION_RATE = 0.12
const MUTATION_SCALE = 0.28
const MAX_POWER = 100
const MIN_POWER = 8
const SIM_STEPS = 120
const PROBE_COUNT = 4

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function randn() {
  let u = 0
  let v = 0
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
    for (let i = 0; i < INPUTS; i++) {
      sum += inputs[i] * genome.w1[i * HIDDEN + h]
    }
    hidden[h] = tanh(sum)
  }

  for (let o = 0; o < OUTPUTS; o++) {
    let sum = genome.b2[o]
    for (let h = 0; h < HIDDEN; h++) {
      sum += hidden[h] * genome.w2[h * OUTPUTS + o]
    }
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

function sortedObjectBalls(state: GameState) {
  return objectBalls(state)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}

function encodeState(state: GameState): number[] {
  const cue = cueBall(state)
  const inputs: number[] = []

  // Cue ball x, y
  if (cue) {
    inputs.push(cue.x / TABLE_W)
    inputs.push(cue.y / TABLE_H)
  } else {
    inputs.push(0, 0)
  }

  // Number of object balls left
  inputs.push(clamp(objectBalls(state).length / OBJECT_SLOTS, 0, 1))

  // Cue-to-pocket distances
  if (cue) {
    for (const p of pockets) {
      const dx = p.x - cue.x
      const dy = p.y - cue.y
      inputs.push(clamp(Math.hypot(dx, dy) / Math.hypot(TABLE_W, TABLE_H), 0, 1))
    }
  } else {
    for (let i = 0; i < pockets.length; i++) inputs.push(0)
  }

  // Every object ball in a stable order
  const balls = sortedObjectBalls(state)
  for (let i = 0; i < OBJECT_SLOTS; i++) {
    const b = balls[i]
    if (!b) {
      inputs.push(0, 0)
      continue
    }

    inputs.push(clamp(b.x / TABLE_W, 0, 1))
    inputs.push(clamp(b.y / TABLE_H, 0, 1))
  }

  // Game over flag
  inputs.push(state.gameOver ? 1 : 0)

  while (inputs.length < INPUTS) inputs.push(0)
  return inputs.slice(0, INPUTS)
}

function simulateShot(state: GameState, shot: Shot): GameState {
  const shotBalls = applyShot(state.balls, shot.angle, shot.power)

  let simBalls = shotBalls
  let pocketed: string[] = []

  for (let i = 0; i < SIM_STEPS; i++) {
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

  const removedBalls = beforeObjects - afterObjects
  const cueStillAlive = !!cueBall(resolved)

  let fitness = 0
  fitness += removedBalls * 180

  if (!cueStillAlive && beforeHasCue) fitness -= 1500
  if (resolved.gameOver && resolved.winner === "ai") fitness += 500
  if (resolved.gameOver && resolved.winner === "human") fitness -= 250

  const movedSomething = resolved.balls.some((b) => Math.abs(b.vx) > 0.01 || Math.abs(b.vy) > 0.01)
  if (!movedSomething) fitness -= 80

  return { fitness, shot }
}

function pickBest<T extends { fitness: number }>(items: T[]) {
  return items.slice().sort((a, b) => b.fitness - a.fitness)
}

function topUniqueCandidates(results: Array<EvalResult & { target_id?: string | null }>, limit = 6): CandidateShot[] {
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
  private latestSettledState: GameState | null = null

  private stateBuffer: GameState[] = []
  private readonly maxBufferSize = 300

  generation = 0
  bestScore = -Infinity
  championPath = "local-typescript"

  constructor(popSize = POP_SIZE) {
    this.population = Array.from({ length: popSize }, () => makeGenome())
  }

  getStatus(): TrainingStatus {
    return {
      generation: this.generation,
      best_score: this.bestScore,
      champion_path: this.championPath,
      updated_at: Date.now() / 1000,
    }
  }

  recordState(state: GameState) {
    if (!isAtRest(state.balls)) return

    const cloned = cloneState(state)
    this.latestSettledState = cloned
    this.stateBuffer.push(cloned)

    if (this.stateBuffer.length > this.maxBufferSize) {
      this.stateBuffer.shift()
    }
  }

  private sampleStates(count: number): GameState[] {
    if (this.stateBuffer.length === 0) return []

    const out: GameState[] = []
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * this.stateBuffer.length)
      out.push(this.stateBuffer[idx])
    }
    return out
  }

  predictShot(state: GameState): Shot & { candidates: CandidateShot[] } {
    const genome = this.champion ?? this.population[0]
    const base = evaluateGenome(genome, state)

    const candidates: Array<EvalResult & { target_id?: string | null }> = [{ ...base, target_id: null }]

    for (let i = 0; i < PROBE_COUNT; i++) {
      const probe = makeGenome()
      probe.w1.set(genome.w1)
      probe.b1.set(genome.b1)
      probe.w2.set(genome.w2)
      probe.b2.set(genome.b2)
      mutate(probe)
      candidates.push({ ...evaluateGenome(probe, state), target_id: null })
    }

    const best = pickBest(candidates)[0]
    const unique = topUniqueCandidates(candidates, 6)

    return {
      angle: best?.shot.angle ?? base.shot.angle,
      power: best?.shot.power ?? base.shot.power,
      candidates: unique,
    }
  }

  trainOneGeneration() {
    if (this.stateBuffer.length === 0) return

    const samples = this.sampleStates(20)
    if (samples.length === 0) return

    const scored = this.population.map((genome) => {
      let fitness = 0
      for (const sample of samples) {
        fitness += evaluateGenome(genome, sample).fitness
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

    const next: Genome[] = [...elites]

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

  trainOnSettledTurn(state: GameState) {
    this.recordState(state)
    this.trainOneGeneration()
  }
}

export const trainer = new NeuroEvoTrainer()

