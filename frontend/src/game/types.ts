type BallState = {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  color: string
}

type Shot = {
  angle: number
  power: number
}

type GameState = {
  balls: BallState[]
  currentPlayer: Player
  gameOver: boolean
  winner: Player | null
  lastShotPocketed: string[]
  currentShotPocketed: string[]
}

type BallProps = {
  id: string
  x: number
  y: number
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
}

type PocketPosition = {
  x: number
  y: number
}

type Player = "human" | "ai"


type StepResult = {
  balls: BallState[]
  pocketed: string[]
}

export type { BallState, BallProps, Pocket, Player, StepResult, Shot, GameState }
