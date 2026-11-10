import type { GameSettings } from "@razzia/common/types/game"
import Switch from "@razzia/web/components/Switch"
import NumberField from "@razzia/web/components/forms/NumberField"
import SettingRow from "@razzia/web/features/game/components/GameSettingsModal/SettingRow"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

const PRESETS = [
  { label: "3m", seconds: 180 },
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
  { label: "15m", seconds: 900 },
  { label: "20m", seconds: 1200 },
]

const UltimateTimer = () => {
  const { control, setValue } = useFormContext<GameSettings>()
  const { t } = useTranslation()
  const enable = useWatch({ control, name: "ultimateTimer.enable" })
  const duration = useWatch({ control, name: "ultimateTimer.duration" }) ?? 600

  const handlePreset = (seconds: number) => {
    setValue("ultimateTimer.duration", seconds, { shouldValidate: true })
  }

  const formatMinutes = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}m ${s > 0 ? `${s}s` : ""}`
  }

  return (
    <>
      <Controller
        control={control}
        name="ultimateTimer.enable"
        render={({ field }) => (
          <SettingRow
            label="game:settings.ultimateTimer.label"
            hint="game:settings.ultimateTimer.hint"
          >
            <Switch
              aria-label={t("game:settings.ultimateTimer.label")}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </SettingRow>
        )}
      />

      {enable && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-primary/5 p-3.5 border border-primary/20">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-semibold uppercase">
              Presets:
            </span>
            {PRESETS.map(({ label, seconds }) => (
              <button
                key={seconds}
                type="button"
                onClick={() => handlePreset(seconds)}
                className={`rounded-md border px-2.5 py-1 text-xs font-bold transition-all ${
                  duration === seconds
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "hover:bg-accent bg-background"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <NumberField
              name="ultimateTimer.duration"
              label="game:settings.ultimateTimer.duration"
              className="w-36"
            />
            <span className="text-xs font-bold text-primary mt-5">
              = {formatMinutes(duration)}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

export default UltimateTimer
