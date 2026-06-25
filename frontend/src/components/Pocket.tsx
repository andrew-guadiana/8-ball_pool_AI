import { POCKET_VISUAL_DIAMETER, POCKET_VISUAL_RADIUS } from "../game/constants"
import type { Pocket } from "../game/types"

export default function Pocket({ x, y }: Pocket) {
  return (
    <div
    style={{
      position: "absolute",
      left: x - POCKET_VISUAL_RADIUS,
      top: y - POCKET_VISUAL_RADIUS,
      width: POCKET_VISUAL_DIAMETER,
      height: POCKET_VISUAL_DIAMETER,
      borderRadius: "50%",
      zIndex: 0,
    }}
    />
  )
}
