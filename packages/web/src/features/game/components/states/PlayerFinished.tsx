import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useTranslation } from "react-i18next"

import { Award, Trophy } from "lucide-react"

interface Props {
  data: CommonStatusDataMap["FINISHED"]
}

const PlayerFinished = ({ data: { rank, subject } }: Props) => {
  const { player } = usePlayerStore()
  const { t } = useTranslation()
  const hasRank = typeof rank === "number"

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
    </div>
  )
}

export default PlayerFinished
