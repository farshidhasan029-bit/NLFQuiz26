import { EVENTS, MEDIA_TYPES, NO_TIME_LIMIT } from "@razzia/common/constants"
import type { QuestionMediaType } from "@razzia/common/types/game"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import QuestionDialog from "@razzia/web/features/game/components/QuestionDialog"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import useScreenSize from "@razzia/web/hooks/useScreenSize"
import { triggerHaptic, HAPTIC_PATTERNS } from "@razzia/web/lib/haptics"
import clsx from "clsx"
import { CircleQuestionMark, Image, Lock, Pause, Video } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

// Tailwind sm breakpoint
const MOBILE_BREAKPOINT = 640

interface Props {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

const Answers = ({
  data: {
    question,
    answers,
    media,
    time,
    totalPlayer,
    questionType,
    options,
    answersOnly,
  },
}: Props) => {
  const { socket, isConnected } = useSocket()
  const { isPaused } = useQuestionStore()
  const { player, gameId } = usePlayerStore()
  const isTimerStopped = !isConnected || isPaused

  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const { t } = useTranslation()
  const { width } = useScreenSize()

  const popupMedia: QuestionMediaType[] = [MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO]
  const isPopupMedia = popupMedia.includes(media?.type)
  const showAnswersOnly = Boolean(player) && answersOnly
  const showMediaInPopup =
    Boolean(player) && width < MOBILE_BREAKPOINT && isPopupMedia

  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, {
    volume: 0.1,
  })

  const [playMusic, { stop: stopMusic }] = useSound(SFX.ANSWERS.MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  const [pendingAnswer, setPendingAnswer] = useState<number[] | null>(null)

  const handleSubmit = (answerKeys: number[]) => {
    if (!player || !gameId) {
      return
    }

    setPendingAnswer(answerKeys)
    triggerHaptic(HAPTIC_PATTERNS.LOCK)

    socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId,
      data: {
        answerKeys,
      },
    })
    sfxPop()
  }

  useEffect(() => {
    if (socket.connected && pendingAnswer && gameId) {
      socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
        gameId,
        data: {
          answerKeys: pendingAnswer,
        },
      })
    }
  }, [socket.connected, pendingAnswer, gameId])

  useEffect(() => {
    const disabledMusicMedia: QuestionMediaType[] = [
      MEDIA_TYPES.AUDIO,
      MEDIA_TYPES.VIDEO,
    ]

    if (disabledMusicMedia.includes(media?.type)) {
      return
    }

    if (isTimerStopped) {
      stopMusic()
    } else {
      playMusic()
    }

    return () => {
      stopMusic()
    }
  }, [playMusic, stopMusic, media?.type, isTimerStopped])

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setCooldown(sec)
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  const { AnswerComponent } = QUESTION_REGISTRY[questionType]

  const MediaIcon = media?.type === MEDIA_TYPES.VIDEO ? Video : Image

  return (
    <div className="relative flex h-full flex-1 flex-col justify-between">
      {pendingAnswer && (
        <div className="pointer-events-none fixed top-4 inset-x-0 z-50 mx-auto flex w-fit items-center gap-2 rounded-2xl bg-black/85 px-5 py-2.5 text-white shadow-2xl backdrop-blur-md border border-white/20 animate-pulse">
          <Lock className="size-5 text-amber-300" />
          <span className="font-extrabold text-sm md:text-base">Answer Locked In!</span>
        </div>
      )}
      {isTimerStopped && (
        <div className="pointer-events-none fixed top-16 inset-x-0 z-40 mx-auto flex w-fit items-center gap-2 rounded-full bg-amber-500/95 px-4 py-1.5 text-xs md:text-sm font-extrabold text-white shadow-xl backdrop-blur-md border border-amber-300/40 animate-pulse">
          <Pause className="size-4 fill-white" />
          <span>
            {!isConnected
              ? t("game:timerStoppedOffline")
              : t("game:timerStoppedGamePaused")}
          </span>
        </div>
      )}
      {showAnswersOnly ? (
        <>
          <QuestionDialog
            question={question}
            media={isPopupMedia ? media : undefined}
            label={t("game:question.show")}
            className="hover:bg-accent absolute top-4 right-4 flex size-11 items-center justify-center rounded-md bg-white text-black"
            showQuestion
          >
            <CircleQuestionMark className="size-6" />
          </QuestionDialog>

          {media?.type === MEDIA_TYPES.AUDIO && (
            <div className="flex justify-center">
              <QuestionMedia media={media} alt={question} />
            </div>
          )}
        </>
      ) : (
        <div className="mx-auto inline-flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5">
          <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
            {question}
          </h2>

          {showMediaInPopup ? (
            <QuestionDialog
              question={question}
              media={media}
              className="hover:bg-accent flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-bold text-black drop-shadow-md"
            >
              <MediaIcon className="size-5" />
              {t(
                media?.type === MEDIA_TYPES.VIDEO
                  ? "game:media.showVideo"
                  : "game:media.showImage",
              )}
            </QuestionDialog>
          ) : (
            <QuestionMedia media={media} alt={question} />
          )}
        </div>
      )}

      <div className={clsx({ "flex flex-1 flex-col": showAnswersOnly })}>
        <div className="mx-auto mb-4 flex w-full max-w-7xl justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
          {time !== NO_TIME_LIMIT && (
            <div
              className={clsx(
                "flex flex-col items-center rounded-xl px-4 py-1 font-bold transition-all shadow-md",
                isTimerStopped
                  ? "bg-amber-500/90 border-2 border-amber-300 text-white animate-pulse"
                  : "bg-black/40 text-white",
              )}
            >
              <span className="translate-y-0.5 text-xs flex items-center gap-1 uppercase tracking-wide">
                {isTimerStopped ? (
                  <>
                    <Pause className="size-3 fill-current" />
                    <span>{t("game:hud.timerStopped")}</span>
                  </>
                ) : (
                  t("game:hud.time")
                )}
              </span>
              <span className="font-mono text-xl">{cooldown}s</span>
            </div>
          )}
          <div className="flex flex-col items-center rounded-lg bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">
              {t("game:hud.answers")}
            </span>
            <span>
              {totalAnswer}/{totalPlayer}
            </span>
          </div>
        </div>

        <AnswerComponent
          answers={answers}
          options={options}
          onSubmit={handleSubmit}
          readOnly={!player}
          fill={showAnswersOnly}
        />
      </div>
    </div>
  )
}

export default Answers
