import type { PlayerFullEvaluation } from "@razzia/common/types/game"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { AlertTriangle, Award, Check, HelpCircle, Trophy, X } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  evaluation: PlayerFullEvaluation
  onClose: () => void
}

const PlayerEvaluationModal = ({ evaluation, onClose }: Props) => {
  const { t } = useTranslation()

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const isWinner = evaluation.rank === 1

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm">
      <div className="bg-slate-900 border-2 border-amber-400/40 text-white flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 bg-gradient-to-r from-amber-500/20 via-transparent to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-black shadow">
              <Trophy className="size-6 text-black" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black truncate">
                {t("game:playerEvalTitle")}
              </h2>
              <p className="text-xs text-white/70 truncate">
                {evaluation.username} · {t("game:playerEvalRankOf", {
                  rank: evaluation.rank,
                  total: evaluation.totalPlayers,
                })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            title={t("common:close")}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Summary Card */}
          <div
            className={clsx(
              "relative overflow-hidden rounded-2xl border p-4 sm:p-5",
              isWinner
                ? "border-amber-400/50 bg-amber-500/10"
                : "border-white/10 bg-white/5",
            )}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
                      isWinner
                        ? "bg-amber-500 text-black"
                        : "bg-white/20 text-white",
                    )}
                  >
                    <Award className="size-3.5" />
                    {isWinner
                      ? t("manager:result.winner")
                      : `#${evaluation.rank}`}
                  </span>
                  <span className="text-xs text-white/70">
                    {evaluation.accuracyPct}% {t("manager:result.accuracy")}
                  </span>
                </div>
                <h3 className="mt-1 text-2xl sm:text-3xl font-black text-white">
                  {evaluation.points.toLocaleString()} pts
                </h3>
              </div>

              {/* Badges strip */}
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1.5 font-bold text-emerald-300">
                  <Check className="size-3.5 stroke-3" />
                  {evaluation.correctCount} {t("manager:result.table.correct")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 border border-red-500/40 px-2.5 py-1.5 font-bold text-red-300">
                  <X className="size-3.5 stroke-3" />
                  {evaluation.incorrectCount} {t("manager:result.table.incorrect")}
                </span>
                {evaluation.unansweredCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-medium text-white/70">
                    <HelpCircle className="size-3.5" />
                    {evaluation.unansweredCount} {t("manager:result.noAnswer")}
                  </span>
                )}
              </div>
            </div>

            {Boolean(
              evaluation.cheatPenaltyPoints &&
                evaluation.cheatPenaltyPoints > 0,
            ) && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-200">
                <AlertTriangle className="size-4 text-red-400 shrink-0" />
                <span className="font-semibold">
                  {t("game:antiCheat.evaluationPenalty", {
                    points: evaluation.cheatPenaltyPoints,
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Question Breakdown List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider uppercase text-white/60">
              {t("game:playerEvalQuestionsReview")} ({evaluation.questions.length})
            </h4>

            {evaluation.questions.map((q, qIdx) => {
              const hasAnswer =
                q.playerAnswerIds !== null && q.playerAnswerIds.length > 0

              return (
                <div
                  key={qIdx}
                  className={clsx(
                    "rounded-xl border p-4 transition-all",
                    q.correct
                      ? "border-emerald-500/30 bg-emerald-950/20"
                      : hasAnswer
                        ? "border-red-500/30 bg-red-950/20"
                        : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-white/50 block">
                        Q{qIdx + 1}
                      </span>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {q.question}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {q.correct ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-400">
                          <Check className="size-3 stroke-3" />
                          +{q.points} pts
                        </span>
                      ) : hasAnswer ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-1 text-xs font-bold text-red-400">
                          <X className="size-3 stroke-3" />
                          0 pts
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white/60">
                          {t("manager:result.noAnswer")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Answers review options */}
                  {q.answers.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.answers.map((answerText, aIdx) => {
                        const isChosen = q.playerAnswerIds?.includes(aIdx)
                        const isSolution = q.solutions?.includes(aIdx)

                        return (
                          <div
                            key={aIdx}
                            className={clsx(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
                              isChosen && isSolution
                                ? "bg-emerald-500/30 border-2 border-emerald-400 text-white font-bold"
                                : isChosen && !isSolution
                                  ? "bg-red-500/30 border-2 border-red-400 text-white font-bold"
                                  : isSolution
                                    ? "bg-emerald-500/15 border border-dashed border-emerald-400/70 text-emerald-200"
                                    : "bg-white/5 border border-white/5 text-white/60",
                            )}
                          >
                            <span
                              className={clsx(
                                "flex size-5 shrink-0 items-center justify-center rounded-md font-bold text-[10px] text-white",
                                ANSWERS_COLORS[aIdx % 4],
                              )}
                            >
                              {ANSWERS_LABELS[aIdx % 4]}
                            </span>
                            <span className="truncate flex-1">
                              {answerText}
                            </span>
                            {isChosen && (
                              <span className="shrink-0 text-[10px] uppercase font-bold text-white/80">
                                ({t("game:playerEvalYourAnswer")})
                              </span>
                            )}
                            {isSolution && !isChosen && (
                              <span className="shrink-0 text-[10px] uppercase font-bold text-emerald-400">
                                ({t("game:playerEvalCorrectSolution")})
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/20 px-5 py-2 text-xs font-bold text-white transition-colors"
          >
            {t("common:close")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PlayerEvaluationModal
