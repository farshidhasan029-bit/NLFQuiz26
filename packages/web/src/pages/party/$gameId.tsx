import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import GameWrapper from "@razzia/web/features/game/components/GameWrapper"
import Loader from "@razzia/web/components/Loader"
import {
  socketClient,
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useSocketConnection } from "@razzia/web/features/game/hooks/useSocketConnection"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import {
  GAME_STATE_COMPONENTS,
  isKeyOf,
} from "@razzia/web/features/game/utils/constants"
import { createStatus } from "@razzia/web/features/game/utils/createStatus"
import { useAntiCheat } from "@razzia/web/features/game/hooks/useAntiCheat"
import { useWakeLock } from "@razzia/web/features/game/hooks/useWakeLock"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const PlayerGamePage = () => {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const { gameId: gameIdParam } = useParams({ from: "/party/$gameId" })
  const { status, updatePlayer, resetPlayer, detectScreenSplit, antiCheatMode } = usePlayerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()
  const syncedRef = useRef(false)

  useSocketConnection()
  useWakeLock()
  useAntiCheat({
    enabled: detectScreenSplit,
    gameId: gameIdParam,
    statusName: status?.name,
    mode: antiCheatMode,
  })

  useEffect(() => {
    if (!isConnected) {
      syncedRef.current = false

      return
    }

    if (syncedRef.current) {
      return
    }

    syncedRef.current = true

    const { joinTicket } = usePlayerStore.getState()

    if (joinTicket) {
      socket.emit(EVENTS.PLAYER.LOGIN, { ticket: joinTicket })

      return
    }

    socket.emit(EVENTS.PLAYER.RECONNECT, { gameId: gameIdParam })
  }, [isConnected, gameIdParam, socket])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const { status: currentStatus } = usePlayerStore.getState()

        // If participant answered and left during the answering phase → boot to pincode
        if (
          currentStatus?.name === STATUS.SELECT_ANSWER &&
          gameIdParam &&
          sessionStorage.getItem(`answered_${gameIdParam}`) === "true"
        ) {
          sessionStorage.removeItem(`answered_${gameIdParam}`)
          resetPlayer()
          setQuestionStates(null)
          navigate({ to: "/" })
          return
        }

        if (!socket.connected) {
          socket.connect()
        } else if (gameIdParam && !usePlayerStore.getState().joinTicket) {
          socket.emit(EVENTS.PLAYER.RECONNECT, { gameId: gameIdParam })
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleVisibility)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleVisibility)
    }
  }, [socket, gameIdParam, navigate, resetPlayer, setQuestionStates])

  useEvent(
    EVENTS.GAME.SUCCESS_JOIN,
    ({
      gameId: joinedGameId,
      username,
      gameMode,
      detectScreenSplit: serverDetectScreenSplit,
      antiCheatMode: serverAntiCheatMode,
      antiCheatPenaltyPoints: serverAntiCheatPenaltyPoints,
      hidePlayerResults: serverHidePlayerResults,
      status: activeStatus,
      currentQuestion,
    }) => {
      updatePlayer({
        gameId: joinedGameId,
        gameMode,
        detectScreenSplit: serverDetectScreenSplit ?? true,
        ...(serverAntiCheatMode && { antiCheatMode: serverAntiCheatMode }),
        ...(serverAntiCheatPenaltyPoints !== undefined && {
          antiCheatPenaltyPoints: serverAntiCheatPenaltyPoints,
        }),
        hidePlayerResults: serverHidePlayerResults ?? true,
        joinTicket: null,
        player: { username, points: 0 },
        status: activeStatus
          ? createStatus(activeStatus.name, activeStatus.data)
          : createStatus(STATUS.WAIT, { text: "game:waitingForPlayers" }),
      })
      if (currentQuestion) {
        setQuestionStates(currentQuestion)
      }
    },
  )

  useEvent(
    EVENTS.PLAYER.SUCCESS_RECONNECT,
    ({
      gameId: reconnectGameId,
      gameMode,
      detectScreenSplit: serverDetectScreenSplit,
      antiCheatMode: serverAntiCheatMode,
      antiCheatPenaltyPoints: serverAntiCheatPenaltyPoints,
      hidePlayerResults: serverHidePlayerResults,
      status: reconnectStatus,
      player,
      currentQuestion,
    }) => {
      updatePlayer({
        gameId: reconnectGameId,
        gameMode,
        detectScreenSplit: serverDetectScreenSplit ?? true,
        ...(serverAntiCheatMode && { antiCheatMode: serverAntiCheatMode }),
        ...(serverAntiCheatPenaltyPoints !== undefined && {
          antiCheatPenaltyPoints: serverAntiCheatPenaltyPoints,
        }),
        hidePlayerResults: serverHidePlayerResults ?? true,
        status: createStatus(reconnectStatus.name, reconnectStatus.data),
        player,
      })
      setQuestionStates(currentQuestion)
    },
  )

  useEvent(EVENTS.GAME.STATUS, ({ name, data }) => {
    if (name in GAME_STATE_COMPONENTS) {
      // Clear submitted flag when game is fully over
      if (name === STATUS.FINISHED && gameIdParam) {
        localStorage.removeItem(`quiz_submitted_${gameIdParam}`)
        // Don't clear eval_status/eval_data here — player may still want to view their evaluation
      }
      // Clear answered flag when question phase ends (new question or reveal)
      if (name !== STATUS.SELECT_ANSWER && gameIdParam) {
        sessionStorage.removeItem(`answered_${gameIdParam}`)
      }
      const dataObj = data as
        | {
            detectScreenSplit?: boolean
            antiCheatMode?: any
            antiCheatPenaltyPoints?: number
            hidePlayerResults?: boolean
          }
        | undefined
      updatePlayer({
        status: createStatus(name, data),
        ...(dataObj?.detectScreenSplit !== undefined && {
          detectScreenSplit: dataObj.detectScreenSplit,
        }),
        ...(dataObj?.antiCheatMode !== undefined && {
          antiCheatMode: dataObj.antiCheatMode,
        }),
        ...(dataObj?.antiCheatPenaltyPoints !== undefined && {
          antiCheatPenaltyPoints: dataObj.antiCheatPenaltyPoints,
        }),
        ...(dataObj?.hidePlayerResults !== undefined && {
          hidePlayerResults: dataObj.hidePlayerResults,
        }),
      })
    }
  })

  useEvent(
    EVENTS.PLAYER.CHEATING_PENALTY,
    ({
      penaltyPoints,
      currentPoints,
    }: {
      penaltyPoints: number
      currentPoints: number
    }) => {
      updatePlayer((prev) => ({
        ...prev,
        player: prev.player
          ? { ...prev.player, points: currentPoints }
          : null,
      }))
      toast.error(
        t("game:antiCheat.penaltyAlert", {
          penaltyPoints,
          currentPoints,
        }),
        {
          duration: 6000,
          id: "anti-cheat-penalty-toast",
        },
      )
    },
    [socket],
  )

  useEvent(EVENTS.GAME.RESET, (message) => {
    localStorage.removeItem("game_pin")
    localStorage.removeItem("game_id")
    if (gameIdParam) {
      localStorage.removeItem(`quiz_submitted_${gameIdParam}`)
      localStorage.removeItem(`eval_status_${gameIdParam}`)
      localStorage.removeItem(`eval_data_${gameIdParam}`)
      sessionStorage.removeItem(`answered_${gameIdParam}`)
    }
    navigate({ to: "/" })
    resetPlayer()
    setQuestionStates(null)
    toast.error(t(message))
  })

  if (!gameIdParam) {
    return null
  }

  const CurrentComponent =
    status && isKeyOf(GAME_STATE_COMPONENTS, status.name)
      ? GAME_STATE_COMPONENTS[status.name]
      : null

  if (!status) {
    return (
      <GameWrapper statusName={undefined}>
        <div className="flex h-full w-full flex-1 flex-col items-center justify-center">
          <Loader className="h-30" />
          <h1 className="mt-4 text-center text-3xl font-bold text-white drop-shadow-lg">
            {t("game:reconnecting")}
          </h1>
        </div>
      </GameWrapper>
    )
  }

  return (
    <GameWrapper statusName={status.name}>
      {detectScreenSplit && (
        <div className="mx-auto my-1 flex items-center justify-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/90 drop-shadow">
          <span>🛡️</span>
          <span>{t("game:antiCheat.banner")}</span>
        </div>
      )}
      {CurrentComponent && <CurrentComponent data={status.data as never} />}
    </GameWrapper>
  )
}

export const Route = createFileRoute("/party/$gameId")({
  component: PlayerGamePage,
  onLeave: ({ params: { gameId } }) => {
    socketClient.emit(EVENTS.PLAYER.LEAVE, { gameId })
  },
})
