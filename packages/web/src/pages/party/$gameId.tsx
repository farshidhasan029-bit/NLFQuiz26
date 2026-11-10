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
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const PlayerGamePage = () => {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const { gameId: gameIdParam } = useParams({ from: "/party/$gameId" })
  const { status, updatePlayer, resetPlayer, detectScreenSplit } = usePlayerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()
  const syncedRef = useRef(false)

  useSocketConnection()
  useAntiCheat({
    enabled: detectScreenSplit,
    gameId: gameIdParam,
    statusName: status?.name,
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

  useEvent(
    EVENTS.GAME.SUCCESS_JOIN,
    ({
      gameId: joinedGameId,
      username,
      gameMode,
      detectScreenSplit: serverDetectScreenSplit,
      hidePlayerResults: serverHidePlayerResults,
    }) => {
      updatePlayer({
        gameId: joinedGameId,
        gameMode,
        detectScreenSplit: serverDetectScreenSplit ?? true,
        hidePlayerResults: serverHidePlayerResults ?? true,
        joinTicket: null,
        player: { username, points: 0 },
        status: createStatus(STATUS.WAIT, { text: "game:waitingForPlayers" }),
      })
    },
  )

  useEvent(
    EVENTS.PLAYER.SUCCESS_RECONNECT,
    ({
      gameId: reconnectGameId,
      gameMode,
      detectScreenSplit: serverDetectScreenSplit,
      hidePlayerResults: serverHidePlayerResults,
      status: reconnectStatus,
      player,
      currentQuestion,
    }) => {
      updatePlayer({
        gameId: reconnectGameId,
        gameMode,
        detectScreenSplit: serverDetectScreenSplit ?? true,
        hidePlayerResults: serverHidePlayerResults ?? true,
        status: createStatus(reconnectStatus.name, reconnectStatus.data),
        player,
      })
      setQuestionStates(currentQuestion)
    },
  )

  useEvent(EVENTS.GAME.STATUS, ({ name, data }) => {
    if (name in GAME_STATE_COMPONENTS) {
      const dataObj = data as { detectScreenSplit?: boolean; hidePlayerResults?: boolean } | undefined
      updatePlayer({
        status: createStatus(name, data),
        ...(dataObj?.detectScreenSplit !== undefined && {
          detectScreenSplit: dataObj.detectScreenSplit,
        }),
        ...(dataObj?.hidePlayerResults !== undefined && {
          hidePlayerResults: dataObj.hidePlayerResults,
        }),
      })
    }
  })

  useEvent(EVENTS.GAME.RESET, (message) => {
    localStorage.removeItem("game_pin")
    localStorage.removeItem("game_id")
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
