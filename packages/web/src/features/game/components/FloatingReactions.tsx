import { EVENTS } from "@razzia/common/constants"
import { useEvent } from "@razzia/web/features/game/contexts/socket-context"
import { useState } from "react"

interface Reaction {
  id: string
  emoji: string
  x: number
}

const FloatingReactions = () => {
  const [reactions, setReactions] = useState<Reaction[]>([])

  useEvent(EVENTS.GAME.REACTION, (newReaction: Reaction) => {
    setReactions((prev) => [...prev.slice(-30), newReaction])

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id))
    }, 2500)
  })

  if (reactions.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="animate-float-reaction absolute bottom-12 select-none text-4xl drop-shadow-lg md:text-6xl"
          style={{
            left: `${r.x}%`,
          }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  )
}

export default FloatingReactions
