import { EVENTS } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { useEvent, useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { Pause } from "lucide-react"
import clsx from "clsx"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SHOW_START"]
}

const Start = ({ data: { time, subject } }: Props) => {
  const [showTitle, setShowTitle] = useState(true)
  const [cooldown, setCooldown] = useState(time)
  const { isConnected } = useSocket()
  const { isPaused } = useQuestionStore()
  const { t } = useTranslation()
  const isStopped = !isConnected || isPaused

  const [sfxBoump] = useSound(SFX.BOUMP_SOUND, {
    volume: 0.2,
  })

  useEvent(EVENTS.GAME.START_COOLDOWN, () => {
    sfxBoump()
    setShowTitle(false)
  })

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    if (!isStopped) {
      sfxBoump()
    }
    setCooldown(sec)
  })

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center">
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
      {showTitle ? (
        <h2 className="anim-show text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
          {subject}
        </h2>
      ) : (
        <>
          <div
            className={clsx(
              `anim-show bg-primary aspect-square h-32 rounded-2xl transition-all md:h-60`,
            )}
            style={{
              transform: `rotate(${45 * (time - cooldown)}deg)`,
            }}
          ></div>
          <span className="absolute text-6xl font-bold text-white drop-shadow-md md:text-8xl">
            {cooldown}
          </span>
        </>
      )}
    </section>
  )
}

export default Start
