import { EVENTS, QUIZZ_MODES } from "@razzia/common/constants"
import {
  STATUS,
  type Status,
  type StatusDataMap,
} from "@razzia/common/types/game/status"
import Button from "@razzia/web/components/Button"
import GameBackground from "@razzia/web/components/GameBackground"
import Loader from "@razzia/web/components/Loader"
import Tooltip from "@razzia/web/components/Tooltip"
import GameSettingsModal from "@razzia/web/features/game/components/GameSettingsModal"
import RoomLockButton from "@razzia/web/features/game/components/RoomLockButton"
import FloatingReactions from "@razzia/web/features/game/components/FloatingReactions"
import ReactionPicker from "@razzia/web/features/game/components/ReactionPicker"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { MANAGER_SKIP_BTN } from "@razzia/web/features/game/utils/constants"
import type { Status as GameStatus } from "@razzia/web/features/game/utils/createStatus"
import { useFullscreen } from "@razzia/web/hooks/useFullscreen"
import clsx from "clsx"
import { Hourglass, Maximize, Minimize, Pause, Play, Users } from "lucide-react"
import { type PropsWithChildren, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type Props = PropsWithChildren & {
  statusName: Status | undefined
  onNext?: () => void
  onBack?: () => void
  manager?: boolean
}

const GameWrapper = ({
  children,
  statusName,
  onNext,
  onBack,
  manager,
}: Props) => {
  const { socket, isConnected } = useSocket()
  const { player, gameMode, hidePlayerResults } = usePlayerStore()
  const { players, inviteCode, locked, status, gameId } = useManagerStore()
  const {
    questionStates,
    setQuestionStates,
    isPaused,
    setPaused,
    pauseReason,
    pauseUsername,
  } = useQuestionStore()
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
  const { t } = useTranslation()
  const [skippedStatus, setSkippedStatus] =
    useState<GameStatus<StatusDataMap> | null>(null)
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<{
    seconds: number
    total: number
  } | null>(null)
  const [ultimateTimer, setUltimateTimer] = useState<{
    remaining: number
    total: number
    active: boolean
    paused: boolean
  } | null>(null)
  const next = statusName ? MANAGER_SKIP_BTN[statusName] : null
  const isDisabled = skippedStatus !== null && skippedStatus === status

  const formatUltimateTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  useEvent(EVENTS.GAME.UPDATE_QUESTION, ({ current, total }) => {
    setQuestionStates({
      current,
      total,
    })
  })

  useEvent(EVENTS.GAME.TOTAL_PLAYERS, (total) => {
    setTotalPlayers(total)
  })

  useEvent(EVENTS.MANAGER.AUTO_ADVANCE, (state) => {
    setCountdown(state)
  })

  useEvent(EVENTS.GAME.ULTIMATE_TIMER_UPDATE, (state: any) => {
    setUltimateTimer(state)
  })

  useEvent(EVENTS.GAME.ULTIMATE_TIMER_EXPIRED, () => {
    toast(t("game:ultimateTimerExpired"), {
      icon: "⏰",
      duration: 6000,
    })
  })

  useEvent(EVENTS.GAME.PAUSE_UPDATE, (data: any) => {
    const paused = typeof data === "boolean" ? data : Boolean(data?.paused)
    setPaused(paused, data?.reason ?? null, data?.username ?? null)
  })

  useEvent(EVENTS.GAME.ERROR_MESSAGE, (message) => {
    toast.error(t(message))
    console.log(t(message))
    setSkippedStatus(null)
  })

  const handleTogglePause = () => {
    const activeGameId = gameId || usePlayerStore.getState().gameId
    if (!activeGameId) return
    if (isPaused) {
      socket.emit(EVENTS.MANAGER.RESUME_GAME, { gameId: activeGameId })
    } else {
      socket.emit(EVENTS.MANAGER.PAUSE_GAME, { gameId: activeGameId })
    }
  }

  const handleNext = () => {
    setSkippedStatus(status)
    onNext?.()
  }

  return (
    <section className="relative flex min-h-dvh">
      <GameBackground />
      <FloatingReactions />

      <div className="z-10 flex w-full flex-1 flex-col justify-between">
        {!isConnected && !statusName ? (
          <div className="flex h-full w-full flex-1 flex-col items-center justify-center">
            <Loader className="h-30" />
            <h1 className="text-4xl font-bold text-white">
              {t("common:connecting")}
            </h1>
          </div>
        ) : (
          <>
            {!isConnected && (
              <div className="z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-center text-sm font-bold text-white shadow-md">
                <span className="inline-block animate-spin">🔄</span>
                <span>{t("game:connectionDisruptedWithTimer")}</span>
              </div>
            )}
            {isPaused && (
              <div className="z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-extrabold text-white shadow-md animate-pulse">
                <Pause className="size-4 fill-white" />
                <span>
                  {pauseReason === "player_offline" && pauseUsername
                    ? t("game:quizPausedPlayerOffline", {
                        username: pauseUsername,
                      })
                    : t("game:quizPausedHost")}
                </span>
              </div>
            )}
            <div className="flex w-full items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {questionStates && (
                  <div className="flex items-center rounded-md bg-white p-2 px-4 text-lg font-bold text-black shadow-md">
                    {`${questionStates.current} / ${questionStates.total}`}
                  </div>
                )}

                {ultimateTimer?.active && ultimateTimer.remaining > 0 && (
                  <div
                    className={clsx(
                      "flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-mono font-black text-base sm:text-lg shadow-lg border transition-all select-none",
                      ultimateTimer.remaining <= 30
                        ? "bg-red-600/95 text-white border-red-400 animate-pulse ring-2 ring-red-400/50"
                        : ultimateTimer.remaining <= 60
                          ? "bg-amber-500/95 text-white border-amber-300 ring-2 ring-amber-300/40"
                          : "bg-black/60 backdrop-blur-md text-amber-300 border-white/20",
                    )}
                  >
                    <Hourglass
                      className={clsx(
                        "size-4 shrink-0",
                        ultimateTimer.paused ? "text-white/60" : "animate-spin text-amber-300",
                      )}
                    />
                    <div className="flex items-baseline gap-1.5">
                      <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-white/80">
                        {t("game:ultimateTimerLabel")}:
                      </span>
                      <span className="tracking-tight">
                        {formatUltimateTimer(ultimateTimer.remaining)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {manager && onBack && (
                <Button
                  onClick={onBack}
                  className="hover:bg-accent bg-white px-4 text-black"
                >
                  {t("common:exit")}
                </Button>
              )}

              {manager && (
                <div className="ml-auto flex items-center gap-2">
                  {statusName === STATUS.SHOW_ROOM && (
                    <RoomLockButton className="hover:bg-accent rounded-lg bg-white px-3 text-black" />
                  )}

                  {statusName !== STATUS.SHOW_ROOM &&
                    statusName !== STATUS.FINISHED && (
                      <Button
                        onClick={handleTogglePause}
                        className="hover:bg-accent flex items-center gap-1.5 rounded-lg bg-white px-3 text-black font-bold"
                      >
                        {isPaused ? (
                          <>
                            <Play className="size-4 fill-black text-black" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="size-4 fill-black text-black" />
                            <span>Pause</span>
                          </>
                        )}
                      </Button>
                    )}

                  {next && (
                    <Button
                      className={clsx(
                        "hover:bg-accent relative overflow-hidden bg-white px-4 text-black",
                        { "pointer-events-none": isDisabled },
                      )}
                      onClick={handleNext}
                    >
                    {countdown && (
                      <span
                        key={countdown.total}
                        className="bg-primary/40 absolute inset-y-0 left-0"
                        style={{
                          animation: `progressBar ${countdown.total}s linear forwards`,
                        }}
                      />
                    )}

                    <span className="relative font-bold">
                      {countdown && countdown.seconds > 0
                        ? `${t(next)} (${countdown.seconds}s)`
                        : t(next)}
                    </span>
                  </Button>
                  )}
                </div>
              )}
            </div>

            {children}

            {manager ? (
              <div
                className={clsx("z-50 flex items-stretch gap-3 p-4", {
                  "absolute inset-x-0 bottom-0": statusName === STATUS.FINISHED,
                })}
              >
                {inviteCode && statusName !== STATUS.SHOW_ROOM && (
                  <div className="flex items-center gap-3 rounded-lg bg-black/40 px-3 py-1.5 text-xl font-bold text-white drop-shadow-md">
                    {!locked && (
                      <>
                        <span>{window.location.host}</span>
                        <span className="h-5 w-px bg-white/40" />
                        <span>{inviteCode}</span>
                      </>
                    )}
                    <RoomLockButton className="-mx-1 rounded-md p-1 hover:bg-white/20" />
                  </div>
                )}

                <Tooltip content={t("game:playersJoined")}>
                  <div className="ml-auto flex items-center gap-2 rounded-lg bg-black/40 px-3 py-1.5 text-xl font-bold text-white drop-shadow-md">
                    <Users className="size-5" />
                    {totalPlayers ?? players.length}
                  </div>
                </Tooltip>

                {statusName === STATUS.SHOW_ROOM && <GameSettingsModal />}

                <Tooltip
                  content={t(
                    isFullscreen
                      ? "common:exitFullscreen"
                      : "common:fullscreen",
                  )}
                >
                  <button
                    onClick={toggleFullscreen}
                    aria-label={t(
                      isFullscreen
                        ? "common:exitFullscreen"
                        : "common:fullscreen",
                    )}
                    className="flex items-center justify-center rounded-lg bg-black/40 px-2.5 text-white drop-shadow-md hover:bg-black/60"
                  >
                    {isFullscreen ? (
                      <Minimize className="size-5" />
                    ) : (
                      <Maximize className="size-5" />
                    )}
                  </button>
                </Tooltip>
              </div>
            ) : (
              <div className="z-50 flex items-center justify-between bg-white px-4 py-2 text-lg font-bold text-white">
                <p className="text-gray-800">{player?.username}</p>
                <div className="flex items-center gap-3">
                  <ReactionPicker />
                  {gameMode !== QUIZZ_MODES.SURVEY && !hidePlayerResults && (
                    <div className="rounded-lg bg-gray-800 px-3 py-1 text-lg">
                      {player?.points}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default GameWrapper
