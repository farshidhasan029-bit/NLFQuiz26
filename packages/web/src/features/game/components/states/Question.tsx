import { MEDIA_TYPES } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { Pause } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SHOW_QUESTION"]
}

const Question = ({ data: { question, media, cooldown } }: Props) => {
  const [sfxShow] = useSound(SFX.SHOW_SOUND, { volume: 0.5 })
  const { isConnected } = useSocket()
  const { isPaused } = useQuestionStore()
  const { t } = useTranslation()
  const isStopped = !isConnected || isPaused

  useEffect(() => {
    sfxShow()
  }, [sfxShow])

  return (
    <section className="relative mx-auto flex h-full w-full max-w-7xl flex-1 flex-col items-center px-4">
      {isStopped && (
        <div className="pointer-events-none fixed top-16 inset-x-0 z-40 mx-auto flex w-fit items-center gap-2 rounded-full bg-amber-500/95 px-4 py-1.5 text-xs md:text-sm font-extrabold text-white shadow-xl backdrop-blur-md border border-amber-300/40 animate-pulse">
          <Pause className="size-4 fill-white" />
          <span>
            {!isConnected
              ? t("game:timerStoppedOffline")
              : t("game:timerStoppedGamePaused")}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <h2 className="anim-show text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
          {question}
        </h2>

        {media?.type === MEDIA_TYPES.IMAGE && (
          <img
            alt={question}
            src={media.url}
            className="max-h-60 w-auto rounded-md sm:max-h-100"
          />
        )}
      </div>
      <div
        className="bg-primary mb-20 h-4 self-start justify-self-end rounded-full transition-all"
        style={{
          animation: `progressBar ${cooldown}s linear forwards`,
          animationPlayState: isStopped ? "paused" : "running",
        }}
      ></div>
    </section>
  )
}

export default Question
