import { BALL_DIAMETER, BALL_RADIUS, pocketImages } from "../game/constants"
import type { BallProps } from "../game/types"

export default function Ball({ id, x, y, onPointerDown }: BallProps) {
  return (
    <div
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onPointerDown?.(e)
      }}
      style={{
        position: "absolute",
        left: x - BALL_RADIUS,
        top: y - BALL_RADIUS,
        width: BALL_DIAMETER,
        height: BALL_DIAMETER,
        borderRadius: "50%",
        cursor: "grab",
      }}
    >
      <img
        src={pocketImages[id]}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
