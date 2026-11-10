import { STATUS } from "@razzia/common/types/game/status"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import { joinGame } from "@razzia/web/features/game/queries"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { createStatus } from "@razzia/web/features/game/utils/createStatus"
import { ApiError } from "@razzia/web/lib/api"
import { triggerHaptic, HAPTIC_PATTERNS } from "@razzia/web/lib/haptics"
import { getDeviceId, recordDeviceJoin } from "@razzia/web/lib/device"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { StatusCodes } from "http-status-codes"
import { type KeyboardEvent, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const AVATARS = [
  "🦁", "🚀", "🦊", "⚡", "🐼", "🐱", "🦄", "🎮", 
  "🌟", "🔥", "🐶", "🦖", "🍕", "🏆", "🎯", "🥑"
]

const Username = () => {
  const { inviteCode, generatedUsernames, updatePlayer } = usePlayerStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    return AVATARS[Math.floor(Math.random() * AVATARS.length)]
  })
  const { t } = useTranslation()

  const { mutate: join, isPending } = useMutation({
    mutationFn: joinGame,
    onSuccess: ({ gameId, ticket, username: name }) => {
      localStorage.setItem("game_id", gameId)

      if (inviteCode) {
        localStorage.setItem("game_pin", inviteCode)
      }

      updatePlayer({
        gameId,
        joinTicket: ticket,
        player: name ? { username: name, points: 0 } : null,
        status: createStatus(STATUS.WAIT, { text: "game:waitingForPlayers" }),
      })
      navigate({ to: "/party/$gameId", params: { gameId } })
    },
    onError: (error) => {
      toast.error(
        t(error instanceof ApiError ? error.key : "errors:route.description"),
      )

      if (error instanceof ApiError && error.status === StatusCodes.NOT_FOUND) {
        updatePlayer({ inviteCode: null, generatedUsernames: false })
      }
    },
  })

  const handleLogin = () => {
    if (!inviteCode) {
      return
    }

    const trimmed = username.trim()
    if (!generatedUsernames && !trimmed) {
      toast.error(t("errors:auth.usernameTooShort"))
      return
    }

    const formatted = generatedUsernames
      ? undefined
      : `${selectedAvatar} ${trimmed}`.slice(0, 24)

    const deviceId = getDeviceId()
    const deviceJoinCount = recordDeviceJoin()

    join({
      inviteCode,
      username: formatted,
      deviceId,
      deviceJoinCount,
    })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleLogin()
    }
  }

  if (generatedUsernames) {
    return (
      <Card>
        <p className="mb-4 text-center text-lg font-semibold">
          {t("game:generatedUsernameNotice")}
        </p>
        <Button onClick={handleLogin} disabled={isPending}>
          {t("common:submit")}
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-4 flex flex-col items-center">
        <p className="mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
          Choose Your Avatar
        </p>
        <div className="mb-3 flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-4xl shadow-inner border border-primary/20">
          {selectedAvatar}
        </div>
        <div className="flex max-w-xs flex-wrap justify-center gap-1.5">
          {AVATARS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                triggerHaptic(HAPTIC_PATTERNS.TAP)
                setSelectedAvatar(emoji)
              }}
              className={clsx(
                "flex size-9 cursor-pointer items-center justify-center rounded-xl text-lg transition-all",
                selectedAvatar === emoji
                  ? "bg-primary text-white scale-110 shadow-md ring-2 ring-primary/40"
                  : "bg-gray-100 hover:bg-gray-200 active:scale-95",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <Input
        className="text-center font-bold text-lg"
        value={username}
        maxLength={20}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("game:usernamePlaceholder")}
      />
      <Button className="mt-4 w-full" onClick={handleLogin} disabled={isPending}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default Username
