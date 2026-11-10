import type { PlayerStatusDataMap } from "@razzia/common/types/game/status"
import Loader from "@razzia/web/components/Loader"
import { CheckCircle2, Lock } from "lucide-react"
import { useTranslation } from "react-i18next"

interface Props {
  data: PlayerStatusDataMap["WAIT"]
}

const Wait = ({ data: { text } }: Props) => {
  const { t } = useTranslation()
  const isAnswerWait =
    text === "game:waitingForAnswers" || text === "game:answerNoted"
  const isWaitHost = text === "game:answerRecordedWaitHost"

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4">
      {isWaitHost ? (
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
