import { EVENTS } from "@razzia/common/constants"
import type { PlayerFullEvaluation } from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import Fire from "@razzia/web/features/game/components/icons/Fire"
import PlayerEvaluationModal from "@razzia/web/features/game/components/states/PlayerEvaluationModal"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { Loader2, User } from "lucide-react"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: ManagerStatusDataMap["SHOW_LEADERBOARD"]
}

const AnimatedPoints = ({ from, to }: { from: number; to: number }) => {
  const spring = useSpring(from, { stiffness: 1000, damping: 30 })
  const display = useTransform(spring, (value) => Math.round(value))
  const [displayValue, setDisplayValue] = useState(from)

  useEffect(() => {
    spring.set(to)
    const unsubscribe = display.on("change", (latest) => {
      setDisplayValue(latest)
    })

    return unsubscribe
  }, [to, spring, display])

  return <span className="drop-shadow-md">{displayValue}</span>
}

const StreakBadge = ({ streak }: { streak: number }) => {
  const { t } = useTranslation()

  return (
    <AnimatePresence>
      {streak >= 2 && (
        <motion.div
          key="streak"
          initial={{ opacity: 0, scale: 0.5, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.5, x: -10 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          role="img"
          aria-label={t("game:streak")}
          className="ml-2 flex items-center gap-1 rounded-full bg-amber-700 p-1"
        >
          <Fire className="size-7" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const Leaderboard = ({ data: { oldLeaderboard, leaderboard } }: Props) => {
  const [displayedLeaderboard, setDisplayedLeaderboard] =
    useState(oldLeaderboard)
  const [isAnimating, setIsAnimating] = useState(false)
  const [selectedEvaluation, setSelectedEvaluation] =
    useState<PlayerFullEvaluation | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const { gameId } = useManagerStore()
  const { socket } = useSocket()
  const { t } = useTranslation()

  useEvent(EVENTS.MANAGER.PLAYER_EVALUATION, (data) => {
    if (data?.evaluation) {
      setSelectedEvaluation(data.evaluation)
    }
    setLoadingId(null)
  })

  const handleViewEvaluation = (playerId: string) => {
    if (!gameId) return
    setLoadingId(playerId)
    socket.emit(EVENTS.MANAGER.GET_PLAYER_EVALUATION, {
      gameId,
      playerId,
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true)
      setDisplayedLeaderboard(leaderboard)
    }, 1600)

    return () => {
      clearTimeout(timer)
    }
  }, [oldLeaderboard, leaderboard])

  return (
    <>
      <section className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-2">
        <h2 className="mb-2 text-5xl font-bold text-white drop-shadow-md">
          {t("game:leaderboard")}
        </h2>
        <p className="mb-6 text-sm font-medium text-white/70">
          {t("game:tapPlayerIconForEval")}
        </p>
        <div className="flex w-full flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {displayedLeaderboard.map(({ id, username, points, streak }) => (
              <motion.div
                key={id}
                layout
                initial={{ opacity: 0, y: 50 }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: 50,
                  transition: { duration: 0.2 },
                }}
                transition={{
                  layout: {
                    type: "spring",
                    stiffness: 350,
                    damping: 25,
                  },
                }}
                className="bg-primary flex w-full items-center justify-between rounded-xl p-3 text-2xl sm:text-3xl font-bold text-white shadow-lg"
              >
                <div className="flex items-center gap-3 drop-shadow-md min-w-0">
                  <button
                    type="button"
                    onClick={() => handleViewEvaluation(id)}
                    title={t("game:tapPlayerIconForEval")}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 hover:bg-white/35 hover:scale-105 active:scale-95 transition-all text-white shadow cursor-pointer border border-white/20"
                  >
                    {loadingId === id ? (
                      <Loader2 className="size-5 animate-spin text-white" />
                    ) : (
                      <User className="size-5 text-white" />
                    )}
                  </button>
                  <span
                    onClick={() => handleViewEvaluation(id)}
                    className="cursor-pointer hover:underline truncate"
                    title={t("game:tapPlayerIconForEval")}
                  >
                    {username}
                  </span>
                  <StreakBadge streak={streak} />
                </div>
                {isAnimating ? (
                  <AnimatedPoints
                    from={oldLeaderboard.find((u) => u.id === id)?.points ?? 0}
                    to={leaderboard.find((u) => u.id === id)?.points ?? 0}
                  />
                ) : (
                  <span className="drop-shadow-md shrink-0">{points}</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {selectedEvaluation && (
        <PlayerEvaluationModal
          evaluation={selectedEvaluation}
          onClose={() => setSelectedEvaluation(null)}
        />
      )}
    </>
  )
}

export default Leaderboard
