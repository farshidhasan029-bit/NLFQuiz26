import { EVENTS } from "@razzia/common/constants"
import type { PlayerFullEvaluation } from "@razzia/common/types/game"
import type { PlayerStatusDataMap } from "@razzia/common/types/game/status"
import Loader from "@razzia/web/components/Loader"
import PlayerEvaluationModal from "@razzia/web/features/game/components/states/PlayerEvaluationModal"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { Award, FileText, Loader2 } from "lucide-react"
import { CheckCircle2, Lock } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

interface Props {
  data: PlayerStatusDataMap["WAIT"]
}

const SubmittedWaitScreen = () => {
  const { t } = useTranslation()
  const { socket } = useSocket()
  const { gameId } = usePlayerStore()

  // Persist evaluation state across phone lock / remounts
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
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-6 flex size-28 items-center justify-center rounded-3xl bg-emerald-500/20 border border-emerald-400/40 shadow-2xl backdrop-blur-md animate-pulse">
        <CheckCircle2 className="size-16 text-emerald-400 drop-shadow-md" />
      </div>
      <h2 className="text-center text-3xl font-extrabold text-white drop-shadow-lg md:text-5xl">
        {t("game:quizSubmittedTitle", "Quiz Submitted!")}
      </h2>
      <p className="mt-4 max-w-md text-center text-lg font-medium text-white/90 md:text-xl drop-shadow">
        {t("game:quizSubmittedWait")}
      </p>
      <div className="mt-6 flex items-center gap-2.5 rounded-full bg-black/40 px-5 py-2.5 text-sm font-semibold text-emerald-300 border border-emerald-400/20 shadow-lg">
        <span className="inline-block size-2.5 rounded-full bg-emerald-400 animate-ping" />
        <span>{t("game:quizSubmittedWait")}</span>
      </div>

      {/* Evaluation request section */}
      <div className="mt-6 flex flex-col items-center gap-3">
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
            <p className="text-white/80 text-xs">{t("game:resultRequestPendingDesc")}</p>
          </div>
        )}
        {requestStatus === "denied" && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-red-950/40 border border-red-500/30 px-6 py-3 text-center max-w-sm">
            <p className="text-xs font-semibold text-red-200">{t("game:resultRequestDenied")}</p>
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

const Wait = ({ data: { text } }: Props) => {
  const { t } = useTranslation()
  const isAnswerWait =
    text === "game:waitingForAnswers" || text === "game:answerNoted"
  const isWaitHost = text === "game:answerRecordedWaitHost"

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4">
      {text === "game:quizSubmittedWait" ? (
        <SubmittedWaitScreen />
      ) : isWaitHost ? (
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6 flex size-28 items-center justify-center rounded-3xl bg-indigo-600/30 backdrop-blur-md border border-indigo-400/40 shadow-2xl animate-pulse">
            <CheckCircle2 className="size-16 text-emerald-400 drop-shadow-md" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-white drop-shadow-lg md:text-5xl">
            {t("game:answerRecordedTitle")}
          </h2>
          <p className="mt-4 max-w-md text-center text-lg font-medium text-white/90 md:text-xl drop-shadow">
            {t("game:answerRecordedWaitHost")}
          </p>
          <div className="mt-8 flex items-center gap-2.5 rounded-full bg-black/40 px-5 py-2.5 text-sm font-semibold text-white/90 border border-white/10 shadow-lg">
            <span className="inline-block size-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{t("game:hostRevealInProgress")}</span>
          </div>
        </div>
      ) : isAnswerWait ? (
        <div className="flex flex-col items-center">
          <div className="relative mb-6 flex size-28 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-md border border-white/30 shadow-2xl">
            <Lock className="size-14 text-amber-300 drop-shadow-md" />
            <div className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full bg-emerald-500 shadow-lg ring-4 ring-white/30">
              <CheckCircle2 className="size-6 text-white" />
            </div>
          </div>
          <h2 className="text-center text-3xl font-extrabold text-white drop-shadow-lg md:text-5xl">
            Answer Locked In!
          </h2>
          <p className="mt-3 text-center text-lg font-medium text-white/90 md:text-xl">
            {t(text)}
          </p>
          <div className="mt-8 flex items-center gap-2 rounded-full bg-black/30 px-5 py-2 text-sm font-semibold text-white/80">
            <Loader className="size-5" />
            <span>Waiting for results...</span>
          </div>
        </div>
      ) : (
        <>
          <Loader className="h-30" />
          <h2 className="mt-5 text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
            {t(text)}
          </h2>
        </>
      )}
    </section>
  )
}

export default Wait
