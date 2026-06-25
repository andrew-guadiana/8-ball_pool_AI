import type { Pocket } from "./types"

export const TABLE_W = 900
export const TABLE_H = 500

export const RAIL_LEFT = 58
export const RAIL_TOP = 50
export const RAIL_RIGHT = 60
export const RAIL_BOTTOM = 55

export const BALL_DIAMETER = 25
export const BALL_RADIUS = BALL_DIAMETER / 2

export const POCKET_VISUAL_DIAMETER = 35
export const POCKET_VISUAL_RADIUS = POCKET_VISUAL_DIAMETER / 2

export const POCKET_SINK_RADIUS = 22
export const SIDE_POCKET_SINK_RADIUS = 10

export const CORNER_POCKET_MOUTH_RADIUS = 25
export const SIDE_POCKET_MOUTH_RADIUS = 20

export const pocketImages: Record<string, string> = {
  cue: "/assets/balls/cue.png",
  "1": "/assets/balls/1.png",
  "2": "/assets/balls/2.png",
  "3": "/assets/balls/3.png",
  "4": "/assets/balls/4.png",
  "5": "/assets/balls/5.png",
  "6": "/assets/balls/6.png",
  "7": "/assets/balls/7.png",
  "8": "/assets/balls/8.png",
  "9": "/assets/balls/9.png",
  "10": "/assets/balls/10.png",
  "11": "/assets/balls/11.png",
  "12": "/assets/balls/12.png",
  "13": "/assets/balls/13.png",
  "14": "/assets/balls/14.png",
  "15": "/assets/balls/15.png",
}

export const pockets: Pocket[] = [
  { x: 57, y: 44 },
  { x: TABLE_W / 2, y: 45 },
  { x: TABLE_W - 62, y: 43 },
  { x: 57, y: TABLE_H - 43 },
  { x: TABLE_W / 2, y: TABLE_H - 50 },
  { x: TABLE_W - 57, y: TABLE_H - 43 },
]
