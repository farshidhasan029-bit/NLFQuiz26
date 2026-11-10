import { EVENTS, MEDIA_TYPES, QUESTION_TYPES } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import AnswerButton from "@razzia/web/features/game/components/AnswerButton"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
} from "@razzia/web/features/game/utils/constants"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { triggerHaptic, HAPTIC_PATTERNS } from "@razzia/web/lib/haptics"
import { AlertDialog as RadixAlertDialog } from "radix-ui"
import Button from "@razzia/web/components/Button"
import clsx from "clsx"
import { Check, ChevronLeft, ChevronRight, FastForward, Send, AlertCircle, Bookmark } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: CommonStatusDataMap["SELF_PACED_QUIZ"]
}

const SelfPacedQuiz = ({ data: { questions } }: Props) => {
  const { socket } = useSocket()
  const { gameId } = usePlayerStore()
  const { t } = useTranslation()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<number, number[]>>(new Map())
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)

  const currentQuestion = questions[currentIndex]
  const total = questions.length

  const currentAnswer = answers.get(currentIndex)
  const isAnswered = currentAnswer !== undefined
  const isSkipped = skipped.has(currentIndex)

  const handleSelectSingle = (optionKey: number) => {
    triggerHaptic(HAPTIC_PATTERNS.TAP)
    const newAnswers = new Map(answers)
    newAnswers.set(currentIndex, [optionKey])
    setAnswers(newAnswers)

    const newSkipped = new Set(skipped)
    newSkipped.delete(currentIndex)
    setSkipped(newSkipped)

    if (socket && gameId) {
      socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
        gameId,
        data: { answerKeys: [optionKey], questionIndex: currentIndex },
      })
    }
  }

  const handleToggleMulti = (optionKey: number) => {
    triggerHaptic(HAPTIC_PATTERNS.TAP)
    const existing = answers.get(currentIndex) ?? []
    const updated = existing.includes(optionKey)
      ? existing.filter((k) => k !== optionKey)
      : [...existing, optionKey]

    const newAnswers = new Map(answers)
    if (updated.length > 0) {
      newAnswers.set(currentIndex, updated)
    } else {
      newAnswers.delete(currentIndex)
    }
    setAnswers(newAnswers)

    const newSkipped = new Set(skipped)
    newSkipped.delete(currentIndex)
    setSkipped(newSkipped)

    if (socket && gameId && updated.length > 0) {
      socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
        gameId,
        data: { answerKeys: updated, questionIndex: currentIndex },
      })
    }
  }

  const handleSkip = () => {
    triggerHaptic(HAPTIC_PATTERNS.TAP)
    if (!answers.has(currentIndex)) {
      const newSkipped = new Set(skipped)
      newSkipped.add(currentIndex)
      setSkipped(newSkipped)

      if (socket && gameId) {
        socket.emit(EVENTS.PLAYER.SKIP_QUESTION, {
          gameId,
          data: { questionIndex: currentIndex },
        })
      }
    }

    // Advance to next question or next unanswered
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmitQuiz = () => {
    triggerHaptic(HAPTIC_PATTERNS.SUCCESS)
    setSubmitConfirmOpen(false)
    if (socket && gameId) {
      socket.emit(EVENTS.PLAYER.SUBMIT_QUIZ, { gameId })
    }
  }

  const answeredCount = answers.size
  const skippedCount = skipped.size
  const unansweredCount = total - answeredCount

  return (
    <div className="flex h-full w-full flex-col justify-between overflow-y-auto px-3 py-2 sm:px-6 sm:py-4">
      {/* Top Question Navigator Bar */}
      <div className="mb-3 flex flex-col gap-2 rounded-2xl bg-black/40 p-3 shadow-lg backdrop-blur-md border border-white/20">
        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white">
          <div className="flex items-center gap-2">
            <Bookmark className="size-4 text-primary" />
            <span>
              {t("game:questionLabel")} {currentIndex + 1} / {total}
            </span>
            {isAnswered && (
              <span className="flex items-center gap-1 rounded-md bg-emerald-500/30 px-2 py-0.5 text-xs text-emerald-300 border border-emerald-400/40">
                <Check className="size-3" /> {t("game:answeredBadge")}
              </span>
            )}
            {isSkipped && !isAnswered && (
              <span className="flex items-center gap-1 rounded-md bg-amber-500/30 px-2 py-0.5 text-xs text-amber-300 border border-amber-400/40">
                <FastForward className="size-3" /> {t("game:skippedBadge")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/70">
              {answeredCount}/{total} {t("game:answered")}
            </span>
          </div>
        </div>

        {/* Navigator Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
          {questions.map((_, idx) => {
            const hasAns = answers.has(idx)
            const hasSkip = skipped.has(idx) && !hasAns
            const isCurrent = idx === currentIndex

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={clsx(
                  "relative flex size-8 sm:size-9 items-center justify-center rounded-xl text-xs sm:text-sm font-black transition-all",
                  isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-black scale-110 z-10",
                  hasAns
                    ? "bg-emerald-600 text-white shadow-emerald-950/50 shadow-md"
                    : hasSkip
                      ? "bg-amber-600 text-white shadow-amber-950/50 shadow-md"
                      : "bg-white/15 text-white/80 hover:bg-white/25",
                )}
                title={`Question ${idx + 1}`}
              >
                <span>{idx + 1}</span>
                {hasAns && (
                  <Check className="absolute -top-1 -right-1 size-3.5 rounded-full bg-emerald-400 text-emerald-950 stroke-[3]" />
                )}
                {hasSkip && (
                  <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] text-amber-950 font-black">
                    ⏭
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Question Body */}
      {currentQuestion && (
        <div className="flex flex-1 flex-col items-center justify-center my-auto w-full max-w-4xl mx-auto">
          {currentQuestion.category && (
            <span className="mb-2 rounded-full bg-primary/30 px-3 py-1 text-xs font-bold text-primary-foreground border border-primary/40">
              {currentQuestion.category}
            </span>
          )}

          <h2 className="mb-4 text-center text-xl sm:text-2xl md:text-3xl font-extrabold text-white drop-shadow-md">
            {currentQuestion.question}
          </h2>

          {currentQuestion.media && (
            <div className="mb-4 max-h-56 max-w-md overflow-hidden rounded-2xl shadow-xl">
              <QuestionMedia media={currentQuestion.media} />
            </div>
          )}

          {/* Options */}
          <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 my-2">
            {currentQuestion.answers.map((ans, key) => {
              const isSelected = currentAnswer?.includes(key)
              const isMulti = currentQuestion.type === QUESTION_TYPES.MULTI

              return (
                <AnswerButton
                  key={key}
                  className={clsx(
                    ANSWERS_COLORS[key % ANSWERS_COLORS.length],
                    isSelected && "ring-4 ring-white shadow-2xl scale-[1.02]",
                  )}
                  label={ANSWERS_LABELS[key % ANSWERS_LABELS.length]}
                  selected={isSelected}
                  onClick={() =>
                    isMulti ? handleToggleMulti(key) : handleSelectSingle(key)
                  }
                >
                  {ans}
                </AnswerButton>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-black/40 p-2.5 shadow-lg backdrop-blur-md border border-white/20">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-white/20"
        >
          <ChevronLeft className="size-4" />
          <span>{t("game:previousQuestion")}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500/30 border border-amber-400/50 px-4 py-2.5 text-sm font-extrabold text-amber-200 transition-all hover:bg-amber-500/40 active:scale-95 shadow-md"
          >
            <FastForward className="size-4 text-amber-300" />
            <span>{t("game:skipQuestion")}</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex === total - 1}
            className="flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-white/20"
          >
            <span>{t("game:nextQuestion")}</span>
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Submit Quiz Confirmation Dialog */}
        <RadixAlertDialog.Root open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
          <RadixAlertDialog.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:bg-emerald-500 active:scale-95"
            >
              <Send className="size-4" />
              <span>{t("game:submitQuiz")}</span>
            </button>
          </RadixAlertDialog.Trigger>

          <RadixAlertDialog.Portal>
            <RadixAlertDialog.Overlay className="data-[state=open]:animate-fade fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
            <RadixAlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl border border-white/20">
              <RadixAlertDialog.Title className="text-foreground text-xl font-bold flex items-center gap-2">
                <AlertCircle className="size-5 text-primary" />
                {t("game:submitQuizConfirmTitle")}
              </RadixAlertDialog.Title>

              <RadixAlertDialog.Description className="text-muted-foreground mt-3 text-sm">
                <div className="flex flex-col gap-2 rounded-xl bg-accent/40 p-3 my-2 text-foreground font-medium">
                  <div className="flex justify-between">
                    <span>{t("game:answered")}:</span>
                    <span className="font-bold text-emerald-500">{answeredCount} / {total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("game:skippedBadge")}:</span>
                    <span className="font-bold text-amber-500">{skippedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("game:unanswered")}:</span>
                    <span className="font-bold text-rose-500">{unansweredCount}</span>
                  </div>
                </div>
                {unansweredCount > 0
                  ? t("game:submitQuizWarningUnanswered")
                  : t("game:submitQuizReady")}
              </RadixAlertDialog.Description>

              <div className="mt-6 flex justify-end gap-2">
                <RadixAlertDialog.Cancel asChild>
                  <Button className="bg-accent text-accent-foreground px-4 py-2 text-sm font-semibold">
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
    </div>
  )
}

export default SelfPacedQuiz
