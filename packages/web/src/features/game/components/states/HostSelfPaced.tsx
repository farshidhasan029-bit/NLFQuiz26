import { EVENTS } from "@razzia/common/constants"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import { useEvent, useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import Button from "@razzia/web/components/Button"
import { AlertDialog as RadixAlertDialog } from "radix-ui"
import clsx from "clsx"
import { Award, CheckCircle2, FastForward, Flag, Hourglass, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: ManagerStatusDataMap["SELF_PACED_QUIZ"]
}

interface PlayerProgress {
  playerId: string
  username: string
  answeredCount: number
  skippedCount: number
  totalQuestions: number
  finished: boolean
}

const HostSelfPaced = ({ data: { questions, totalQuestions } }: Props) => {
  const { gameId, players, settings } = useManagerStore()
  const { socket } = useSocket()
  const { t } = useTranslation()

  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [progressMap, setProgressMap] = useState<Map<string, PlayerProgress>>(() => {
    const init = new Map<string, PlayerProgress>()
    for (const p of players) {
      init.set(p.id, {
        playerId: p.id,
        username: p.username,
        answeredCount: 0,
        skippedCount: 0,
        totalQuestions: totalQuestions || questions.length,
        finished: false,
      })
    }
    return init
  })

  // Listen for progress updates from the server
  useEvent(
    EVENTS.GAME.PLAYER_PROGRESS_UPDATE,
    (data: PlayerProgress) => {
      setProgressMap((prev) => {
        const next = new Map(prev)
        next.set(data.playerId, data)
        return next
      })
    },
    [socket],
  )

  useEvent(
    EVENTS.MANAGER.PLAYER_EXPELLED,
    ({ playerId }: { playerId: string }) => {
      setProgressMap((prev) => {
        const next = new Map(prev)
        next.delete(playerId)
        return next
      })
    },
    [socket],
  )

  useEvent(
    EVENTS.MANAGER.PLAYER_KICKED,
    (kickedPlayerId: string) => {
      setProgressMap((prev) => {
        const next = new Map(prev)
        next.delete(kickedPlayerId)
        return next
      })
    },
    [socket],
  )

  const handleFinishQuiz = () => {
    setConfirmEndOpen(false)
    if (socket && gameId) {
      socket.emit(EVENTS.MANAGER.ADVANCE, { gameId })
    }
  }

  const progressList = Array.from(progressMap.values())
  const totalSubmissions = progressList.filter((p) => p.finished).length
  const totalParticipants = progressList.length

  return (
    <div className="flex h-full w-full flex-col justify-between overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-black/40 p-5 shadow-2xl backdrop-blur-md border border-white/20">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-primary">
            {t("game:selfPacedExamTitle")}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white drop-shadow-md">
            {t("game:examInProgress")}
          </h1>
          <p className="text-sm font-medium text-white/70">
            {totalQuestions || questions.length} {t("game:questionsTotal")} • {totalSubmissions} / {totalParticipants} {t("game:submitted")}
          </p>
        </div>

        {/* Action button to end quiz */}
        <RadixAlertDialog.Root open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
          <RadixAlertDialog.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 px-6 py-3.5 text-base font-black text-white shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              <Flag className="size-5" />
              <span>{t("game:finishAndReveal")}</span>
            </button>
          </RadixAlertDialog.Trigger>

          <RadixAlertDialog.Portal>
            <RadixAlertDialog.Overlay className="data-[state=open]:animate-fade fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
            <RadixAlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl border border-white/20">
              <RadixAlertDialog.Title className="text-foreground text-xl font-bold flex items-center gap-2">
                <Flag className="size-5 text-red-500" />
                {t("game:finishQuizConfirmTitle")}
              </RadixAlertDialog.Title>

              <RadixAlertDialog.Description className="text-muted-foreground mt-3 text-sm">
                {t("game:finishQuizConfirmDesc", {
                  submitted: totalSubmissions,
                  total: totalParticipants,
                })}
              </RadixAlertDialog.Description>

              <div className="mt-6 flex justify-end gap-2">
                <RadixAlertDialog.Cancel asChild>
                  <Button className="bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold">
                    {t("common:cancel")}
                  </Button>
                </RadixAlertDialog.Cancel>

                <RadixAlertDialog.Action asChild>
                  <Button
                    className="bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-500"
                    onClick={handleFinishQuiz}
                  >
                    {t("game:finishQuizNow")}
                  </Button>
                </RadixAlertDialog.Action>
              </div>
            </RadixAlertDialog.Content>
          </RadixAlertDialog.Portal>
        </RadixAlertDialog.Root>
      </div>

      {/* Participants Live Grid */}
      <div className="my-6 grid flex-1 auto-rows-max grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {progressList.map((prog) => {
          const totalQ = prog.totalQuestions || totalQuestions || questions.length || 1
          const percent = Math.min(100, Math.round((prog.answeredCount / totalQ) * 100))

          return (
            <div
              key={prog.playerId}
              className={clsx(
                "flex flex-col justify-between rounded-2xl p-4 shadow-xl backdrop-blur-md transition-all border",
                prog.finished
                  ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-100"
                  : "bg-black/40 border-white/20 text-white",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-base font-extrabold">{prog.username}</h3>
                  {prog.finished ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                      <CheckCircle2 className="size-3" />
                      <span>{t("game:submittedBadge")}</span>
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                      {t("game:inProgressBadge")}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-white/70">
                  <span>
                    {prog.answeredCount} / {totalQ} {t("game:answered")}
                  </span>
                  {prog.skippedCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-300">
                      <FastForward className="size-3" />
                      <span>{prog.skippedCount} {t("game:skippedBadge")}</span>
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-300",
                      prog.finished ? "bg-emerald-400" : "bg-primary",
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 text-right text-xs font-black text-white/50">
                {percent}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default HostSelfPaced
