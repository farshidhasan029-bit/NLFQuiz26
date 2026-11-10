import { EVENTS } from "@razzia/common/constants"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { triggerHaptic, HAPTIC_PATTERNS } from "@razzia/web/lib/haptics"
import { useRef } from "react"

const REACTION_EMOJIS = ["❤️", "🔥", "👏", "😂", "🎉"]

const ReactionPicker = () => {
  const { socket } = useSocket()
  const { gameId, player } = usePlayerStore()
  const lastReactionRef = useRef(0)

  if (!player || !gameId) {
    return null
  }

  const handleReact = (emoji: string) => {
    const now = Date.now()
    if (now - lastReactionRef.current < 200) {
      return
    }
    lastReactionRef.current = now

    triggerHaptic(HAPTIC_PATTERNS.TAP)
    socket.emit(EVENTS.PLAYER.SEND_REACTION, {
      gameId,
      emoji,
    })
  }

  return (
    <div className="flex items-center justify-center gap-2 rounded-full bg-black/50 backdrop-blur-md px-3 py-1.5 shadow-xl border border-white/20">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleReact(emoji)}
          className="flex size-9 cursor-pointer items-center justify-center rounded-full text-xl transition-transform hover:scale-125 active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

export default ReactionPicker
