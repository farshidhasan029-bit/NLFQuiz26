import type { GameSettings } from "@razzia/common/types/game"
import SettingRow from "@razzia/web/features/game/components/GameSettingsModal/SettingRow"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Users } from "lucide-react"

const PRESETS = [
  { label: "Unlimited", count: 0 },
  { label: "5", count: 5 },
  { label: "10", count: 10 },
  { label: "20", count: 20 },
  { label: "30", count: 30 },
  { label: "50", count: 50 },
  { label: "100", count: 100 },
]

const MaxParticipants = () => {
  const { control, setValue } = useFormContext<GameSettings>()
  const { t } = useTranslation()
  const maxParticipants = useWatch({ control, name: "maxParticipants" }) ?? 0

  const handleSelect = (count: number) => {
    setValue("maxParticipants", count, { shouldValidate: true })
  }

  return (
    <>
      <SettingRow
        label="game:settings.maxParticipants.label"
        hint="game:settings.maxParticipants.hint"
      >
        <div className="flex items-center gap-1.5 font-bold text-sm text-primary">
          <Users className="size-4" />
          <span>{maxParticipants > 0 ? maxParticipants : t("game:unlimited")}</span>
        </div>
      </SettingRow>

      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-primary/5 p-3.5 border border-primary/20">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs font-semibold uppercase mr-1">
            Presets:
          </span>
          {PRESETS.map(({ label, count }) => (
            <button
              key={count}
              type="button"
              onClick={() => handleSelect(count)}
              className={`rounded-md border px-2.5 py-1 text-xs font-bold transition-all ${
                maxParticipants === count
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "hover:bg-accent bg-background"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs font-bold text-muted-foreground">
            Custom Capacity:
          </label>
          <input
            type="number"
            min={0}
            max={1000}
            value={maxParticipants}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              handleSelect(Number.isNaN(val) ? 0 : Math.max(0, val))
            }}
            className="w-24 rounded-md border border-input bg-background px-2.5 py-1 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">
            {maxParticipants === 0 ? `(${t("game:unlimited")})` : `players max`}
          </span>
        </div>
      </div>
    </>
  )
}

export default MaxParticipants
