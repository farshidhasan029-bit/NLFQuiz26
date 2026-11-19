import { EVENTS } from "@razzia/common/constants"
import type { PlayerFullEvaluation } from "@razzia/common/types/game"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import PlayerEvaluationModal from "@razzia/web/features/game/components/states/PlayerEvaluationModal"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { Award, FileText, Loader2, Trophy } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

interface Props {
  data: CommonStatusDataMap["FINISHED"]
}

const PlayerFinished = ({ data: { rank, subject } }: Props) => {
  const { player, gameId } = usePlayerStore()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const hasRank = typeof rank === "number"

  const storageKey = gameId ? `eval_status_${gameId}` : null
  const evalDataKey = gameId ? `eval_data_${gameId}` : null

  const [requestStatus, setRequestStatus] = useState<
    "idle" | "pending" | "approved" | "denied"
  >(() => {
    if (storageKey && typeof localStorage !== "undefined") {
      return (localStorage.getItem(storageKey) as "idle" | "pending" | "approved" | "denied") ?? "idle"
    }
    return "idle"
  })

  const [evaluation, setEvaluation] = useState<PlayerFullEvaluation | null>(() => {
    if (evalDataKey && typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem(evalDataKey)
        return raw ? (JSON.parse(raw) as PlayerFullEvaluation) : null
      } catch {
        return null
      }
    }
    return null
  })

  const [showModal, setShowModal] = useState(false)

  useEvent(EVENTS.PLAYER.RESULTS_EVALUATION, (data) => {
    if (data.approved && data.evaluation) {
      setRequestStatus("approved")
      setEvaluation(data.evaluation)
      setShowModal(true)
      if (storageKey) localStorage.setItem(storageKey, "approved")
      if (evalDataKey) localStorage.setItem(evalDataKey, JSON.stringify(data.evaluation))
      toast.success(t("game:resultRequestApprovedToast"))
    } else {
      setRequestStatus("denied")
      if (storageKey) localStorage.setItem(storageKey, "denied")
      toast.error(t("game:resultRequestDeniedToast"))
    }
  })

  const handleSendQuery = () => {
    if (!gameId) return
    setRequestStatus("pending")
    if (storageKey) localStorage.setItem(storageKey, "pending")
    socket.emit(EVENTS.PLAYER.REQUEST_RESULTS, { gameId })
    toast(t("game:resultRequestSentToast"))
  }

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="relative mb-2 flex size-24 items-center justify-center rounded-3xl bg-amber-500/20 backdrop-blur-md border border-amber-400/40 shadow-2xl">
        <Trophy className="size-14 text-amber-300 drop-shadow-md" />
      </div>

      <p className="text-center text-4xl font-extrabold text-white drop-shadow-lg md:text-5xl">
        {subject}
      </p>

      {hasRank ? (
        <>
          <p className="text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
            {t("game:rank", { count: rank, ordinal: true })}
          </p>
          <p className="mt-2 rounded bg-black/40 px-6 py-2 text-2xl font-bold text-white">
            {player?.points ?? 0} pts
          </p>
        </>
      ) : (
        <div className="max-w-md">
          <p className="text-2xl font-bold text-white drop-shadow-md md:text-3xl">
            {t("game:quizFinishedTitle")}
          </p>
          <p className="mt-3 text-lg font-medium text-white/90 md:text-xl">
            {t("game:quizFinishedWaitHost")}
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black/40 px-5 py-2 text-sm font-semibold text-white/80 border border-white/10 shadow-lg">
            <Award className="size-4 text-amber-300" />
            <span>{t("game:watchHostScreenPodium")}</span>
          </div>
        </div>
      )}

      {/* Participant Result Query Action Section */}
      <div className="mt-4 flex flex-col items-center gap-3">
        {requestStatus === "idle" && (
          <button
            onClick={handleSendQuery}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 font-bold text-white shadow-xl hover:from-amber-400 hover:to-amber-500 transition-all transform active:scale-95"
          >
            <FileText className="size-5" />
            <span>{t("game:requestResultBtn")}</span>
          </button>
        )}

        {requestStatus === "pending" && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/40 border border-white/20 px-6 py-4 backdrop-blur-md max-w-sm">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Loader2 className="size-4 animate-spin" />
              <span>{t("game:resultRequestPendingTitle")}</span>
            </div>
            <p className="text-white/80 text-xs">
              {t("game:resultRequestPendingDesc")}
            </p>
          </div>
        )}

        {requestStatus === "denied" && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-red-950/40 border border-red-500/30 px-6 py-3 text-center max-w-sm">
            <p className="text-xs font-semibold text-red-200">
              {t("game:resultRequestDenied")}
            </p>
            <button
              onClick={handleSendQuery}
              className="text-xs font-bold text-amber-300 underline hover:text-amber-200"
            >
              {t("game:resultRequestTryAgain")}
            </button>
          </div>
        )}

        {requestStatus === "approved" && evaluation && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3 font-bold text-white shadow-xl transition-all transform active:scale-95"
          >
            <Award className="size-5" />
            <span>{t("game:viewMyEvaluationBtn")}</span>
          </button>
        )}
      </div>

      {showModal && evaluation && (
        <PlayerEvaluationModal
          evaluation={evaluation}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

export default PlayerFinished
