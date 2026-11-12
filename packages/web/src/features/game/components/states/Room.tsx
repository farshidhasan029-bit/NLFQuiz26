import { EVENTS } from "@razzia/common/constants"
import type { Player } from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import PlayerConnectionStatus from "@razzia/web/features/game/components/PlayerConnectionStatus"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import { useOnClickOutside } from "@razzia/web/hooks/useOnClickOutside"
import Switch from "@razzia/web/components/Switch"
import { updateGameSettings } from "@razzia/web/features/manager/queries"
import { ApiError } from "@razzia/web/lib/api"
import { useMutation } from "@tanstack/react-query"
import clsx from "clsx"
import { Check, Clock, Copy, Hourglass, Lock, Maximize2, Share2, Smartphone, Users, X } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { AlertDialog } from "radix-ui"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

interface Props {
  data: ManagerStatusDataMap["SHOW_ROOM"]
}

const Room = ({ data: { text, inviteCode } }: Props) => {
  const { gameId, players, locked, settings, updateManager } = useManagerStore()
  const { socket } = useSocket()
  const webUrl = window.location.origin
  const [playerList, setPlayerList] =
    useState<Array<Player & { timedOut?: boolean }>>(players)
  const [qrOpen, setQrOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const qrContentRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  const handleCopyLink = async () => {
    if (!inviteCode) return
    const link = `${webUrl}?pin=${inviteCode}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success("Direct join link copied to clipboard!")
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error("Could not copy link")
    }
  }

  const handleShareLink = async () => {
    if (!inviteCode) return
    const link = `${webUrl}?pin=${inviteCode}`
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join Quiz Game!",
          text: `Join the quiz with PIN: ${inviteCode}`,
          url: link,
        })
      } catch {
        // user cancelled share
      }
    }
  }

  const { mutate: saveSettings } = useMutation({
    mutationFn: updateGameSettings,
    onSuccess: ({ settings: saved }) => {
      updateManager({ settings: saved })
    },
    onError: (error) => {
      toast.error(
        t(error instanceof ApiError ? error.key : "errors:route.description"),
      )
    },
  })

  const handleToggleAutoAdvance = (enable: boolean) => {
    if (!gameId) return
    const newSettings = {
      ...settings,
      autoAdvance: {
        ...settings.autoAdvance,
        enable,
      },
    }
    updateManager({ settings: newSettings })
    saveSettings({ gameId, json: newSettings })
  }

  const handleUpdateDelay = (delay: number) => {
    if (!gameId || delay < 3 || delay > 600) return
    const newSettings = {
      ...settings,
      autoAdvance: {
        ...settings.autoAdvance,
        enable: true,
        responsesDelay: delay,
        leaderboardDelay: delay,
      },
    }
    updateManager({ settings: newSettings })
    saveSettings({ gameId, json: newSettings })
  }

  useOnClickOutside({ ref: qrContentRef, handler: () => setQrOpen(false) })

  useEvent(EVENTS.MANAGER.NEW_PLAYER, (player) => {
    setPlayerList([...playerList, player])
  })

  useEvent(EVENTS.MANAGER.REMOVE_PLAYER, (playerId) => {
    setPlayerList(playerList.filter((p) => p.id !== playerId))
  })

  useEvent(EVENTS.MANAGER.PLAYER_KICKED, (playerId) => {
    setPlayerList(playerList.filter((p) => p.id !== playerId))
  })

  useEvent(
    EVENTS.MANAGER.PLAYER_UPDATED,
    ({ previousId, player, timedOut }) => {
      setPlayerList((list) =>
        list.map((p) => (p.id === previousId ? { ...player, timedOut } : p)),
      )
    },
  )

  const handleKick = (playerId: string) => () => {
    if (!gameId) {
      return
    }

    socket.emit(EVENTS.MANAGER.KICK_PLAYER, {
      gameId,
      playerId,
    })
  }

  const handleCloseQrCode = () => setQrOpen(false)

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-2">
      <div className="mb-10 flex flex-col-reverse items-center gap-3 md:flex-row md:items-stretch">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-col items-center justify-center rounded-xl bg-white px-6 py-4 md:flex-row">
            <div>
              <p className="text-2xl font-bold">{t("game:joinInstruction")}</p>
              <p className="max-w-64 text-lg font-extrabold break-all">
                {webUrl}
              </p>
            </div>

            <div className="my-4 h-0.5 w-full bg-gray-300 md:mx-4 md:h-full md:w-0.5" />

            <div>
              <p className="text-2xl font-bold">{t("game:gamePinLabel")}</p>
              <p className="text-6xl font-extrabold tabular-nums">
                {locked
                  ? Array.from(inviteCode ?? "", (_, i) => (
                      <span
                        key={i}
                        className="inline-block w-[1ch] text-center"
                      >
                        #
                      </span>
                    ))
                  : inviteCode}
              </p>
            </div>

            {!locked && inviteCode && (
              <>
                <div className="my-4 h-0.5 w-full bg-gray-300 md:mx-4 md:h-full md:w-0.5" />

                <div className="flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-primary/90 hover:scale-105 active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check className="size-4" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" />
                        <span>Copy Join Link</span>
                      </>
                    )}
                  </button>
                  {typeof navigator !== "undefined" && "share" in navigator && (
                    <button
                      type="button"
                      onClick={handleShareLink}
                      className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-black"
                    >
                      <Share2 className="size-3.5" />
                      <span>Share</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {locked ? (
          <div className="flex size-40 shrink-0 items-center justify-center rounded-xl bg-white p-2">
            <Lock className="size-16" />
          </div>
        ) : (
          <AlertDialog.Root open={qrOpen} onOpenChange={setQrOpen}>
            <AlertDialog.Trigger
              aria-label={t("game:showQrCode")}
              className="group relative flex h-40 shrink-0 cursor-pointer rounded-xl bg-white p-2"
            >
              <QRCodeSVG
                className="h-auto w-auto"
                value={`${webUrl}?pin=${inviteCode}`}
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 transition-opacity group-hover:opacity-100">
                <div className="rounded-md bg-black/80 p-2">
                  <Maximize2 className="size-6 text-white" />
                </div>
              </div>
            </AlertDialog.Trigger>

            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
              <AlertDialog.Content
                ref={qrContentRef}
                className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6"
              >
                <button
                  onClick={handleCloseQrCode}
                  aria-label={t("common:close")}
                  className="hover:bg-muted absolute -top-3 -right-3 rounded-full bg-white p-1.5 shadow-md"
                >
                  <X className="text-foreground size-6" />
                </button>
                <QRCodeSVG
                  className="size-56 md:size-70 lg:size-95"
                  value={`${webUrl}?pin=${inviteCode}`}
                />
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-black/40 px-5 py-3 text-white shadow-xl backdrop-blur-md border border-white/20">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-amber-300" />
          <span className="text-base font-bold tracking-wide">
            {t("game:settings.autoAdvance.label")}:
          </span>
        </div>

        <Switch
          checked={settings.autoAdvance.enable}
          onCheckedChange={handleToggleAutoAdvance}
          aria-label={t("game:settings.autoAdvance.label")}
        />

        {settings.autoAdvance.enable && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-white/30 pt-2 md:pt-0 md:pl-3">
            <span className="text-sm font-medium text-white/80">Question Delay:</span>
            {[3, 5, 10, 15].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => handleUpdateDelay(sec)}
                className={clsx(
                  "cursor-pointer rounded-lg px-2.5 py-1 text-sm font-bold transition-all",
                  settings.autoAdvance.responsesDelay === sec
                    ? "bg-primary text-white shadow-md scale-105"
                    : "bg-white/20 text-white hover:bg-white/30",
                )}
              >
                {sec}s
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={3}
                max={600}
                value={settings.autoAdvance.responsesDelay}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  if (!Number.isNaN(val)) {
                    handleUpdateDelay(val)
                  }
                }}
                className="w-14 rounded-lg bg-white/20 px-2 py-1 text-center text-sm font-bold text-white focus:bg-white/30 focus:outline-none"
              />
              <span className="text-xs text-white/70">s</span>
            </div>
          </div>
        )}
      </div>

      {settings.ultimateTimer?.enable && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-indigo-950/60 px-4 py-2 text-white shadow-lg backdrop-blur-md border border-indigo-400/30">
          <Hourglass className="size-4 text-indigo-300 animate-spin" />
          <span className="text-sm font-bold text-indigo-200">
            {t("game:settings.ultimateTimer.label")}:
          </span>
          <span className="rounded-lg bg-indigo-500/30 px-2 py-0.5 text-sm font-black text-white">
            {Math.floor(settings.ultimateTimer.duration / 60)}m {settings.ultimateTimer.duration % 60 > 0 ? `${settings.ultimateTimer.duration % 60}s` : ""}
          </span>
        </div>
      )}

      {settings.maxParticipants > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-black/40 px-4 py-2 text-white shadow-lg backdrop-blur-md border border-white/20">
          <Users className="size-4 text-emerald-300" />
          <span className="text-sm font-bold text-white/80">
            {t("game:settings.maxParticipants.label")}:
          </span>
          <span
            className={clsx(
              "rounded-lg px-2.5 py-0.5 text-sm font-black",
              playerList.length >= settings.maxParticipants
                ? "bg-rose-500/80 text-white animate-pulse"
                : "bg-emerald-500/30 text-emerald-200",
            )}
          >
            {playerList.length} / {settings.maxParticipants}
          </span>
          {playerList.length >= settings.maxParticipants && (
            <span className="rounded bg-rose-600 px-2 py-0.5 text-xs font-black text-white">
              {t("game:capacityReached")}
            </span>
          )}
        </div>
      )}

      {playerList.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-black/40 px-5 py-2 text-white shadow-xl backdrop-blur-md border border-white/20 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 font-bold text-cyan-300">
            <Smartphone className="size-4" />
            <span>Device Audit:</span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded-md bg-white/10 px-2 py-0.5 font-bold text-white">
              {new Set(playerList.map((p) => p.deviceId || p.id)).size} unique devices
            </span>
            {playerList.some((p) => (p.deviceJoinCount ?? 1) > 1) ? (
              <span className="flex items-center gap-1 rounded-md bg-amber-500/30 border border-amber-400/50 px-2 py-0.5 font-extrabold text-amber-300 animate-pulse">
                <span>⚠️</span>
                <span>
                  {playerList.filter((p) => (p.deviceJoinCount ?? 1) > 1).length} repeat device joins
                </span>
              </span>
            ) : (
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
                ✓ All unique devices
              </span>
            )}
          </div>
        </div>
      )}

      <h2 className="mb-6 text-4xl font-bold text-white drop-shadow-lg">
        {t(text)}
      </h2>

      <div className="flex flex-wrap gap-3">
        {playerList.map((player) => {
          const joinCount = player.deviceJoinCount ?? 1
          const isMultiple = joinCount > 1

          return (
            <div
              key={player.id}
              className={clsx(
                "relative flex flex-col items-start gap-1 rounded-2xl px-5 py-3 font-bold text-white transition-all shadow-lg select-none",
                isMultiple
                  ? "bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 ring-2 ring-amber-400/60 shadow-amber-950/40"
                  : "bg-primary has-[[data-lost]]:bg-primary/50",
                player.connected ? "hover:scale-105 cursor-pointer" : "opacity-60",
              )}
              onClick={handleKick(player.id)}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl sm:text-3xl drop-shadow-sm hover:line-through hover:decoration-3">
                  {player.username}
                </span>

                {isMultiple ? (
                  <span
                    title={t("game:deviceJoinCount", { count: joinCount })}
                    className="flex items-center gap-1 rounded-lg bg-black/40 px-2 py-0.5 text-xs font-black text-amber-200 border border-amber-300/40 shadow-sm"
                  >
                    <span>⚠️ 📱</span>
                    <span>{joinCount}x Joins</span>
                  </span>
                ) : (
                  <span
                    title="1st join from this device"
                    className="flex items-center gap-1 rounded-lg bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold text-white/90"
                  >
                    <span>📱</span>
                    <span>1x</span>
                  </span>
                )}
              </div>

              {!player.connected && (
                <PlayerConnectionStatus
                  key={String(player.timedOut)}
                  timedOut={player.timedOut}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default Room
