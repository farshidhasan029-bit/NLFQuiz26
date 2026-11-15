import { EVENTS } from "@razzia/common/constants"
import type { PlayerFullEvaluation } from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import HostResultQueries from "@razzia/web/features/game/components/states/HostResultQueries"
import PlayerEvaluationModal from "@razzia/web/features/game/components/states/PlayerEvaluationModal"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { SFX } from "@razzia/web/features/game/utils/constants"
import useScreenSize from "@razzia/web/hooks/useScreenSize"
import clsx from "clsx"
import { Loader2, User, Users, X } from "lucide-react"
import { useEffect, useState } from "react"
import ReactConfetti from "react-confetti"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: ManagerStatusDataMap["FINISHED"]
}

const SUSPENSE_MIN_PLAYERS = 3
const SUSPENSE_SPOTLIGHT_STEP = 3

const usePodiumAnimation = (topLength: number) => {
  const hasSuspense = topLength >= SUSPENSE_MIN_PLAYERS
  const [apparition, setApparition] = useState(() => (hasSuspense ? 0 : 4))

  const [sfxtThree] = useSound(SFX.PODIUM.THREE, { volume: 0.1 })
  const [sfxSecond] = useSound(SFX.PODIUM.SECOND, { volume: 0.1 })
  const [sfxRool, { stop: sfxRoolStop }] = useSound(SFX.PODIUM.SNEAR_ROOL, {
    volume: 0.1,
  })
  const [sfxFirst] = useSound(SFX.PODIUM.FIRST, { volume: 0.1 })

  useEffect(() => {
    const actions: Partial<Record<number, () => void>> = {
      4: () => {
        sfxRoolStop()
        sfxFirst()
      },
      3: sfxRool,
      2: sfxSecond,
      1: sfxtThree,
    }

    actions[apparition]?.()
  }, [apparition, sfxFirst, sfxSecond, sfxtThree, sfxRool, sfxRoolStop])

  useEffect(() => {
    if (apparition >= 4) {
      return
    }

    const interval = setInterval(() => {
      setApparition((value) => value + 1)
    }, 2000)

    return () => clearInterval(interval)
  }, [apparition, topLength])

  return { apparition, hasSuspense }
}

const medalColor = [
  {
    background: "bg-yellow-500",
    border: "border-yellow-600",
  },
  {
    background: "bg-gray-400",
    border: "border-gray-200",
  },
  {
    background: "bg-amber-700",
    border: "border-amber-800",
  },
]

const Medal = ({ rank }: { rank: number }) => {
  const color = medalColor[rank - 1]

  return (
    <div
      className={clsx(
        "relative flex aspect-square size-20 items-center justify-center overflow-hidden rounded-full border-8 text-5xl font-extrabold text-white drop-shadow-sm md:size-26 md:border-10 md:text-6xl",
        color.background,
        color.border,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <div className="absolute top-[30%] left-1/2 h-6 w-[160%] -translate-x-1/2 -rotate-40 bg-white/25" />
        <div className="absolute top-[70%] left-1/2 h-3 w-[160%] -translate-x-1/2 -rotate-40 bg-white/25" />
      </div>
      <p
        className="relative z-10"
        style={{ textShadow: "2px 2px rgba(0,0,0, 0.25)" }}
      >
        {rank}
      </p>
    </div>
  )
}

const Podium = ({ data: { subject, top } }: Props) => {
  const { apparition, hasSuspense } = usePodiumAnimation(top.length)

  const { width, height } = useScreenSize()
  const { gameId, players } = useManagerStore()
  const { socket } = useSocket()
  const { t } = useTranslation()

  const [selectedEvaluation, setSelectedEvaluation] =
    useState<PlayerFullEvaluation | null>(null)
  const [loadingUsername, setLoadingUsername] = useState<string | null>(null)
  const [showAllPlayers, setShowAllPlayers] = useState(false)

  useEvent(EVENTS.MANAGER.PLAYER_EVALUATION, (data) => {
    if (data?.evaluation) {
      setSelectedEvaluation(data.evaluation)
    }
    setLoadingUsername(null)
  })

  const handleViewEvaluation = (usernameOrId: string) => {
    if (!gameId) return
    setLoadingUsername(usernameOrId)
    socket.emit(EVENTS.MANAGER.GET_PLAYER_EVALUATION, {
      gameId,
      playerId: usernameOrId,
    })
  }

  return (
    <>
      {apparition >= 4 && (
        <ReactConfetti
          width={width}
          height={height}
          className="h-full w-full"
        />
      )}

      {hasSuspense && apparition >= SUSPENSE_SPOTLIGHT_STEP && (
        <div className="pointer-events-none absolute min-h-dvh w-full overflow-hidden">
          <div className="spotlight"></div>
        </div>
      )}
      <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-between">
        <div className="flex flex-col items-center gap-1.5 anim-show">
          <h2 className="text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
            {subject}
          </h2>
          <p className="text-xs sm:text-sm font-medium text-white/70 drop-shadow">
            {t("game:tapPlayerIconForEval")}
          </p>
          {players.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllPlayers(true)}
              className="mt-1 flex items-center gap-1.5 rounded-full bg-black/40 hover:bg-black/60 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md transition-all border border-white/10 cursor-pointer hover:scale-105 active:scale-95"
            >
              <Users className="size-3.5" />
              <span>
                {t("game:playersJoined")} ({players.length})
              </span>
            </button>
          )}
        </div>

        <div
          style={{ gridTemplateColumns: `repeat(${top.length}, 1fr)` }}
          className={`grid w-full max-w-200 flex-1 items-end justify-center justify-self-end overflow-x-visible overflow-y-hidden`}
        >
          {top[1] && (
            <div
              className={clsx(
                "z-20 flex h-[50%] w-full translate-y-full flex-col items-center justify-center gap-3 opacity-0 transition-all",
                { "translate-y-0! opacity-100": apparition >= 2 },
              )}
            >
              <button
                type="button"
                onClick={() => handleViewEvaluation(top[1].username)}
                title={t("game:tapPlayerIconForEval")}
                className={clsx(
                  "group flex items-center justify-center gap-2 overflow-visible text-center text-2xl font-bold whitespace-nowrap text-white drop-shadow-lg md:text-4xl cursor-pointer hover:scale-105 active:scale-95 transition-transform",
                  {
                    "anim-balanced": apparition >= 4,
                  },
                )}
              >
                <div className="flex size-7 md:size-9 items-center justify-center rounded-full bg-white/20 border border-white/30 text-white shadow group-hover:bg-white/30 shrink-0">
                  {loadingUsername === top[1].username ? (
                    <Loader2 className="size-4 md:size-5 animate-spin text-white" />
                  ) : (
                    <User className="size-4 md:size-5 text-white" />
                  )}
                </div>
                <span className="hover:underline truncate max-w-36 md:max-w-48">
                  {top[1].username}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleViewEvaluation(top[1].username)}
                title={t("game:tapPlayerIconForEval")}
                className="bg-primary flex h-full w-full flex-col items-center gap-4 rounded-t-xl pt-6 text-center shadow-2xl cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all"
              >
                <Medal rank={2} />
                <p className="text-3xl font-bold text-white drop-shadow-sm md:text-4xl">
                  {top[1].points}
                </p>
              </button>
            </div>
          )}

          <div
            className={clsx(
              "z-30 flex h-[60%] w-full translate-y-full flex-col items-center gap-3 opacity-0 transition-all",
              {
                "translate-y-0! opacity-100": apparition >= 3,
              },
              {
                "md:min-w-64": top.length < 2,
              },
            )}
          >
            <button
              type="button"
              onClick={() => handleViewEvaluation(top[0].username)}
              title={t("game:tapPlayerIconForEval")}
              className={clsx(
                "group flex items-center justify-center gap-2 overflow-visible text-center text-2xl font-bold whitespace-nowrap text-white opacity-0 drop-shadow-lg md:text-4xl cursor-pointer hover:scale-105 active:scale-95 transition-transform",
                { "anim-balanced opacity-100": apparition >= 4 },
              )}
            >
              <div className="flex size-7 md:size-9 items-center justify-center rounded-full bg-white/20 border border-white/30 text-white shadow group-hover:bg-white/30 shrink-0">
                {loadingUsername === top[0].username ? (
                  <Loader2 className="size-4 md:size-5 animate-spin text-white" />
                ) : (
                  <User className="size-4 md:size-5 text-white" />
                )}
              </div>
              <span className="hover:underline truncate max-w-36 md:max-w-48">
                {top[0].username}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleViewEvaluation(top[0].username)}
              title={t("game:tapPlayerIconForEval")}
              className="bg-primary flex h-full w-full flex-col items-center gap-4 rounded-t-xl pt-6 text-center shadow-2xl cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all"
            >
              <Medal rank={1} />
              <p className="text-3xl font-bold text-white drop-shadow-sm md:text-4xl">
                {top[0].points}
              </p>
            </button>
          </div>

          {top[2] && (
            <div
              className={clsx(
                "z-10 flex h-[40%] w-full translate-y-full flex-col items-center gap-3 opacity-0 transition-all",
                {
                  "translate-y-0! opacity-100": apparition >= 1,
                },
              )}
            >
              <button
                type="button"
                onClick={() => handleViewEvaluation(top[2].username)}
                title={t("game:tapPlayerIconForEval")}
                className={clsx(
                  "group flex items-center justify-center gap-2 overflow-visible text-center text-2xl font-bold whitespace-nowrap text-white drop-shadow-lg md:text-4xl cursor-pointer hover:scale-105 active:scale-95 transition-transform",
                  {
                    "anim-balanced": apparition >= 4,
                  },
                )}
              >
                <div className="flex size-7 md:size-9 items-center justify-center rounded-full bg-white/20 border border-white/30 text-white shadow group-hover:bg-white/30 shrink-0">
                  {loadingUsername === top[2].username ? (
                    <Loader2 className="size-4 md:size-5 animate-spin text-white" />
                  ) : (
                    <User className="size-4 md:size-5 text-white" />
                  )}
                </div>
                <span className="hover:underline truncate max-w-36 md:max-w-48">
                  {top[2].username}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleViewEvaluation(top[2].username)}
                title={t("game:tapPlayerIconForEval")}
                className="bg-primary flex h-full w-full flex-col items-center gap-4 rounded-t-xl pt-6 text-center shadow-2xl cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all"
              >
                <Medal rank={3} />
                <p className="text-3xl font-bold text-white drop-shadow-sm md:text-4xl">
                  {top[2].points}
                </p>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Modal for All Players */}
      {showAllPlayers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-amber-400/40 text-white flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 bg-gradient-to-r from-amber-500/20 via-transparent to-transparent">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-amber-400" />
                <h3 className="text-lg font-bold">{t("game:playersJoined")}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAllPlayers(false)}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="px-5 pt-3 text-xs text-white/60">
              {t("game:tapPlayerIconForEval")}
            </p>
            <div className="flex flex-col gap-2 p-5 overflow-y-auto">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleViewEvaluation(p.id)}
                  className="flex items-center justify-between rounded-xl bg-white/10 hover:bg-white/20 p-3 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/30 text-amber-300 font-bold">
                      {loadingUsername === p.id ? (
                        <Loader2 className="size-4 animate-spin text-white" />
                      ) : (
                        <User className="size-4" />
                      )}
                    </div>
                    <span className="font-bold text-white truncate group-hover:text-amber-300">
                      {p.username}
                    </span>
                  </div>
                  <span className="text-xs text-amber-400/80 font-medium shrink-0">
                    {t("game:tapPlayerIconForEval")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedEvaluation && (
        <PlayerEvaluationModal
          evaluation={selectedEvaluation}
          onClose={() => setSelectedEvaluation(null)}
        />
      )}

      <HostResultQueries />
    </>
  )
}

export default Podium
