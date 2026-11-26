import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import GameWrapper from "@razzia/web/features/game/components/GameWrapper"
import {
  socketClient,
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useSocketConnection } from "@razzia/web/features/game/hooks/useSocketConnection"
import { useWakeLock } from "@razzia/web/features/game/hooks/useWakeLock"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { createStatus } from "@razzia/web/features/game/utils/createStatus"
import {
  GAME_STATE_COMPONENTS_MANAGER,
  isKeyOf,
} from "@razzia/web/features/game/utils/constants"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useEffect } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ManagerGamePage = () => {
  const navigate = useNavigate()
  const { gameId: gameIdParam } = useParams({ from: "/party/manager/$gameId" })
  const { socket, isConnected } = useSocket()
  const { gameId, status, updateManager, resetManager } = useManagerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()

  useSocketConnection()
  useWakeLock()

  useEvent(EVENTS.GAME.STATUS, ({ name, data }) => {
    if (name in GAME_STATE_COMPONENTS_MANAGER) {
      updateManager({ status: createStatus(name, data) })
    }
  })

  useEffect(() => {
    if (isConnected && gameIdParam) {
      socket.emit(EVENTS.MANAGER.RECONNECT, { gameId: gameIdParam })
    }
  }, [isConnected, gameIdParam, socket])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!socket.connected) {
          socket.connect()
        } else if (gameIdParam) {
          socket.emit(EVENTS.MANAGER.RECONNECT, { gameId: gameIdParam })
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleVisibility)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleVisibility)
    }
  }, [socket, gameIdParam])

  useEvent(
    EVENTS.MANAGER.SUCCESS_RECONNECT,
    ({
      gameId: reconnectGameId,
      inviteCode,
      settings,
      locked,
      status: reconnectStatus,
      players,
      currentQuestion,
    }) => {
      updateManager({
        gameId: reconnectGameId,
        inviteCode,
        settings,
        locked,
        status: createStatus(reconnectStatus.name, reconnectStatus.data),
        players,
      })
      setQuestionStates(currentQuestion)
    },
  )

  useEvent(EVENTS.MANAGER.LOCK_UPDATED, (locked) => {
    updateManager({ locked })
  })

  useEvent(EVENTS.MANAGER.PLAYER_CHEAT_DETECTED, ({ username, reason, playerId }: { username: string; reason: string; playerId: string }) => {
    const action = reason === "screen_split" ? "split their screen" : "switched tabs"
    const toastId = `cheat-${playerId}-${Date.now()}`
    toast(
      (toastInstance) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "220px" }}>
          <div style={{ fontWeight: 700, fontSize: "14px" }}>🚨 Cheat detected</div>
          <div style={{ fontSize: "13px", color: "#555" }}>
            <strong>{username}</strong> {action}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button
              onClick={() => {
                socket.emit(EVENTS.MANAGER.KICK_PLAYER, { gameId, playerId })
                toast.dismiss(toastInstance.id)
              }}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "4px 14px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Kick
            </button>
            <button
              onClick={() => toast.dismiss(toastInstance.id)}
              style={{
                background: "#e5e7eb",
                color: "#374151",
                border: "none",
                borderRadius: "6px",
                padding: "4px 14px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Ignore
            </button>
          </div>
        </div>
      ),
      {
        duration: 15000,
        id: toastId,
        style: { maxWidth: "320px" },
      },
    )
  })

  useEvent(EVENTS.GAME.RESET, (message) => {
    navigate({ to: "/manager/config" })
    resetManager()
    setQuestionStates(null)
    toast.error(t(message))
  })

  useEvent(
    EVENTS.MANAGER.DUPLICATE_DEVICE_SUBMIT,
    ({
      deviceId,
      firstUsername,
      duplicateUsername,
    }: {
      deviceId: string
      firstUsername: string
      duplicateUsername: string
    }) => {
      const toastId = `dup-device-${deviceId}-${Date.now()}`
      toast(
        (toastInstance) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "220px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px" }}>📱 Multi-device alert</div>
            <div style={{ fontSize: "13px", color: "#555" }}>
              <strong>{duplicateUsername}</strong> tried to submit from the same device as{" "}
              <strong>{firstUsername}</strong>. The duplicate answer was <strong>blocked</strong>.
            </div>
            <button
              onClick={() => toast.dismiss(toastInstance.id)}
              style={{
                marginTop: "4px",
                background: "#e5e7eb",
                color: "#374151",
                border: "none",
                borderRadius: "6px",
                padding: "4px 14px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              Dismiss
            </button>
          </div>
        ),
        {
          duration: 15000,
          id: toastId,
          style: { maxWidth: "340px" },
        },
      )
    },
  )

  const handleSkip = () => {
    if (!status) {
      return
    }

    if (status.name === STATUS.FINISHED || status.name === STATUS.SUMMARY) {
      navigate({ to: "/manager/config" })
      resetManager()
      setQuestionStates(null)

      return
    }

    if (!gameId) {
      return
    }

    if (status.name === STATUS.SHOW_ROOM) {
      socket.emit(EVENTS.MANAGER.START_GAME, { gameId })

      return
    }

    socket.emit(EVENTS.MANAGER.ADVANCE, { gameId })
  }

  const handleBack = () => {
    navigate({ to: "/manager/config" })
    resetManager()
    setQuestionStates(null)
  }

  const CurrentComponent =
    status && isKeyOf(GAME_STATE_COMPONENTS_MANAGER, status.name)
      ? GAME_STATE_COMPONENTS_MANAGER[status.name]
      : null

  if (!status) {
    return null
  }

  return (
    <GameWrapper
      statusName={status.name}
      onNext={handleSkip}
      onBack={status.name === STATUS.SHOW_ROOM ? handleBack : undefined}
      manager
    >
      {CurrentComponent && <CurrentComponent data={status.data as never} />}
    </GameWrapper>
  )
}

export const Route = createFileRoute("/party/manager/$gameId")({
  component: ManagerGamePage,
  onLeave: ({ params: { gameId } }) => {
    socketClient.emit(EVENTS.MANAGER.LEAVE, { gameId })
  },
})
