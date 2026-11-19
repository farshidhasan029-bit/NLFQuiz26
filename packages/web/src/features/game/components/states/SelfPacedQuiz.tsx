import { EVENTS, QUESTION_TYPES } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import Button from "@razzia/web/components/Button"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import AnswerButton from "@razzia/web/features/game/components/AnswerButton"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import { HAPTIC_PATTERNS, triggerHaptic } from "@razzia/web/lib/haptics"
import clsx from "clsx"
import {
  AlertCircle,
  ArrowDown,
  Check,
  CheckCircle2,
  FileCheck2,
  Layers,
  Send,
} from "lucide-react"
import { AlertDialog as RadixAlertDialog } from "radix-ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: CommonStatusDataMap["SELF_PACED_QUIZ"]
}

const SelfPacedQuiz = ({ data: { questions } }: Props) => {
  const { socket } = useSocket()
  const { gameId } = usePlayerStore()
  const { t } = useTranslation()

  const [answers, setAnswers] = useState<Map<number, number[]>>(new Map())
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(() => {
    if (typeof localStorage !== "undefined" && gameId) {
      return localStorage.getItem(`quiz_submitted_${gameId}`) === "true"
    }
    return false
  })

  const total = questions.length
  const answeredCount = answers.size
  const unansweredCount = total - answeredCount
  const progressPct = total > 0 ? Math.round((answeredCount / total) * 100) : 0

  const handleSelectSingle = (qIndex: number, optionKey: number) => {
    triggerHaptic(HAPTIC_PATTERNS.TAP)
    const newAnswers = new Map(answers)
    newAnswers.set(qIndex, [optionKey])
    setAnswers(newAnswers)

    if (socket && gameId) {
      socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
        gameId,
        data: { answerKeys: [optionKey], questionIndex: qIndex },
      })
    }
  }

  const handleToggleMulti = (qIndex: number, optionKey: number) => {
    triggerHaptic(HAPTIC_PATTERNS.TAP)
    const existing = answers.get(qIndex) ?? []
    const updated = existing.includes(optionKey)
      ? existing.filter((k) => k !== optionKey)
      : [...existing, optionKey]

    const newAnswers = new Map(answers)
    if (updated.length > 0) {
      newAnswers.set(qIndex, updated)
    } else {
      newAnswers.delete(qIndex)
    }
    setAnswers(newAnswers)

    if (socket && gameId && updated.length > 0) {
      socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
        gameId,
        data: { answerKeys: updated, questionIndex: qIndex },
      })
    }
  }

  const scrollToQuestion = (idx: number) => {
    const el = document.getElementById(`question-card-${idx}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  const jumpToNextUnanswered = () => {
    for (let i = 0; i < total; i++) {
      if (!answers.has(i) || (answers.get(i)?.length ?? 0) === 0) {
        scrollToQuestion(i)
        break
      }
    }
  }

  const handleSubmitQuiz = () => {
    triggerHaptic(HAPTIC_PATTERNS.SUCCESS)
    setSubmitConfirmOpen(false)
    setIsSubmitted(true)
    if (typeof localStorage !== "undefined" && gameId) {
      localStorage.setItem(`quiz_submitted_${gameId}`, "true")
    }
    if (socket && gameId) {
      socket.emit(EVENTS.PLAYER.SUBMIT_QUIZ, { gameId })
    }
  }

  // If already submitted by player, show submitted waiting screen
  if (isSubmitted) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-white">
        <div className="relative mb-4 flex size-24 items-center justify-center rounded-3xl bg-emerald-500/20 border border-emerald-400/40 shadow-2xl backdrop-blur-md">
          <CheckCircle2 className="size-14 text-emerald-400 animate-pulse" />
        </div>
        <h2 className="text-3xl font-black sm:text-4xl">
          {t("game:quizSubmittedTitle", "Quiz Submitted!")}
        </h2>
        <p className="mt-2 max-w-md text-base text-white/80">
          {t("game:quizSubmittedWait")}
        </p>
        <div className="mt-6 rounded-2xl bg-black/40 border border-white/10 px-6 py-3 font-semibold text-emerald-300">
          {answeredCount} / {total} {t("game:answered")}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto">
      {/* Sticky Top Header Bar */}
      <div className="sticky top-0 z-30 flex flex-col gap-2 border-b border-white/15 bg-black/70 px-3 py-2.5 shadow-xl backdrop-blur-xl sm:px-6 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow">
              <Layers className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-primary-foreground sm:text-sm">
                  {t("game:allQuestionsHeader", "All Questions")}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/90">
                  {answeredCount}/{total} {t("game:answered")}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/10 sm:w-44">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {unansweredCount > 0 && (
              <button
                type="button"
                onClick={jumpToNextUnanswered}
                className="hidden items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-bold text-white transition-all sm:flex"
                title={t("game:nextUnanswered", "Next unanswered")}
              >
                <ArrowDown className="size-3.5" />
                <span>{t("game:nextUnanswered", "Next unanswered")}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSubmitConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-black text-white shadow-lg transition-all active:scale-95 sm:text-sm sm:px-5"
            >
              <Send className="size-3.5 sm:size-4" />
              <span>{t("game:submitQuiz")}</span>
            </button>
          </div>
        </div>

        {/* Quick jump question numbers strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
          {questions.map((_, idx) => {
            const hasAns =
              answers.has(idx) && (answers.get(idx)?.length ?? 0) > 0

            return (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToQuestion(idx)}
                className={clsx(
                  "relative flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-black transition-all sm:size-8",
                  hasAns
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white/10 text-white/70 hover:bg-white/20",
                )}
                title={`Question ${idx + 1}`}
              >
                <span>{idx + 1}</span>
                {hasAns && (
                  <Check className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-400 text-emerald-950 stroke-[3]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Questions List (All 30 questions rendered as a whole!) */}
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-3 py-6 sm:px-6">
        {questions.map((q, qIndex) => {
          const currentAnswer = answers.get(qIndex)
          const isAnswered =
            currentAnswer !== undefined && currentAnswer.length > 0
          const isMulti = q.type === QUESTION_TYPES.MULTI

          return (
            <div
              key={qIndex}
              id={`question-card-${qIndex}`}
              className={clsx(
                "relative scroll-mt-36 rounded-3xl p-5 shadow-2xl backdrop-blur-md transition-all sm:p-7 border-2",
                isAnswered
                  ? "border-emerald-500/40 bg-black/50 shadow-emerald-950/20"
                  : "border-white/15 bg-black/40",
              )}
            >
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-xl bg-primary text-xs font-black text-white shadow">
                    {qIndex + 1}
                  </span>
                  <span className="text-sm font-bold text-white/90">
                    {t("game:questionLabel")} {qIndex + 1} / {total}
                  </span>
                  {q.category && (
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/80 border border-white/10">
                      {q.category}
                    </span>
                  )}
                  {isMulti && (
                    <span className="rounded-full bg-indigo-500/30 px-2.5 py-0.5 text-[11px] font-bold text-indigo-200 border border-indigo-400/30">
                      {t("game:multiChoiceHint", "Multiple Choice")}
                    </span>
                  )}
                </div>

                <div>
                  {isAnswered ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/40">
                      <Check className="size-3.5 stroke-3" />
                      {t("game:answeredBadge")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/60">
                      ○ {t("game:unanswered")}
                    </span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <h3 className="mb-4 text-lg font-bold text-white drop-shadow sm:text-xl md:text-2xl">
                {q.question}
              </h3>

              {/* Question Media */}
              {q.media && (
                <div className="mb-4 max-h-64 max-w-md overflow-hidden rounded-2xl shadow-xl">
                  <QuestionMedia media={q.media} />
                </div>
              )}

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {q.answers.map((ans, optKey) => {
                  const isSelected = currentAnswer?.includes(optKey)

                  return (
                    <AnswerButton
                      key={optKey}
                      className={clsx(
                        ANSWERS_COLORS[optKey % ANSWERS_COLORS.length],
                        isSelected
                          ? "ring-4 ring-white shadow-2xl scale-[1.01] brightness-110"
                          : "opacity-85 hover:opacity-100",
                      )}
                      label={ANSWERS_LABELS[optKey % ANSWERS_LABELS.length]}
                      selected={isSelected}
                      onClick={() =>
                        isMulti
                          ? handleToggleMulti(qIndex, optKey)
                          : handleSelectSingle(qIndex, optKey)
                      }
                    >
                      {ans}
                    </AnswerButton>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Bottom Submission Action Card */}
        <div className="mt-4 flex flex-col items-center gap-4 rounded-3xl bg-black/60 p-6 sm:p-8 text-center text-white shadow-2xl backdrop-blur-xl border border-white/20">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400">
            <FileCheck2 className="size-7" />
          </div>

          <div>
            <h4 className="text-xl font-black sm:text-2xl">
              {t("game:readyToSubmitTitle", "Ready to Submit Your Quiz?")}
            </h4>
            <p className="mt-1 text-sm text-white/70">
              {answeredCount === total
                ? t(
                    "game:allQuestionsCompletedDesc",
                    "You have completed all questions!",
                  )
                : t("game:someQuestionsRemainDesc", {
                    answered: answeredCount,
                    total,
                    remain: unansweredCount,
                    defaultValue: `You have answered ${answeredCount} of ${total} questions (${unansweredCount} remaining).`,
                  })}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {unansweredCount > 0 && (
              <button
                type="button"
                onClick={jumpToNextUnanswered}
                className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-5 py-3 text-sm font-bold text-white transition-all"
              >
                <ArrowDown className="size-4" />
                <span>
                  {t("game:jumpToUnansweredBtn", "Review Unanswered")}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSubmitConfirmOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-7 py-3 text-base font-black text-white shadow-xl transition-all transform active:scale-95"
            >
              <Send className="size-5" />
              <span>{t("game:submitQuizNow")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Submit Quiz Confirmation Dialog */}
      <RadixAlertDialog.Root
        open={submitConfirmOpen}
        onOpenChange={setSubmitConfirmOpen}
      >
        <RadixAlertDialog.Portal>
          <RadixAlertDialog.Overlay className="data-[state=open]:animate-fade fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
          <RadixAlertDialog.Content className="bg-slate-900 text-white fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl border-2 border-white/20">
            <RadixAlertDialog.Title className="text-xl font-bold flex items-center gap-2 text-white">
              <AlertCircle className="size-5 text-amber-400" />
              {t("game:submitQuizConfirmTitle")}
            </RadixAlertDialog.Title>

            <RadixAlertDialog.Description className="mt-3 text-sm text-white/80">
              <div className="flex flex-col gap-2 rounded-xl bg-white/5 border border-white/10 p-3 my-2 font-medium">
                <div className="flex justify-between">
                  <span>{t("game:answered")}:</span>
                  <span className="font-bold text-emerald-400">
                    {answeredCount} / {total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t("game:unanswered")}:</span>
                  <span className="font-bold text-amber-400">
                    {unansweredCount}
                  </span>
                </div>
              </div>
              {unansweredCount > 0
                ? t("game:submitQuizWarningUnanswered")
                : t("game:submitQuizReady")}
            </RadixAlertDialog.Description>

            <div className="mt-6 flex justify-end gap-2">
              <RadixAlertDialog.Cancel asChild>
                <Button className="bg-white/10 text-white hover:bg-white/20 px-4 py-2 text-sm font-semibold">
                  {t("common:cancel")}
                </Button>
              </RadixAlertDialog.Cancel>

              <RadixAlertDialog.Action asChild>
                <Button
                  className="bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                  onClick={handleSubmitQuiz}
                >
                  {t("game:submitQuizNow")}
                </Button>
              </RadixAlertDialog.Action>
            </div>
          </RadixAlertDialog.Content>
        </RadixAlertDialog.Portal>
      </RadixAlertDialog.Root>
    </div>
  )
}

export default SelfPacedQuiz
