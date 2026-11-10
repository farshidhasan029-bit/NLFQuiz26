import type { GameSettings } from "@razzia/common/types/game"
import Switch from "@razzia/web/components/Switch"
import NumberField from "@razzia/web/components/forms/NumberField"
import SettingRow from "@razzia/web/features/game/components/GameSettingsModal/SettingRow"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

const AutoAdvance = () => {
  const { control, setValue } = useFormContext<GameSettings>()
  const { t } = useTranslation()
  const enable = useWatch({ control, name: "autoAdvance.enable" })

  const handlePreset = (sec: number) => {
    setValue("autoAdvance.responsesDelay", sec, { shouldValidate: true })
    setValue("autoAdvance.leaderboardDelay", sec, { shouldValidate: true })
  }

  return (
    <>
      <Controller
        control={control}
        name="autoAdvance.enable"
        render={({ field }) => (
          <SettingRow
            label="game:settings.autoAdvance.label"
            hint="game:settings.autoAdvance.hint"
          >
            <Switch
              aria-label={t("game:settings.autoAdvance.label")}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </SettingRow>
        )}
      />

      {enable && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-semibold uppercase">
              Quick presets:
            </span>
            {[3, 5, 10, 15].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => handlePreset(sec)}
                className="hover:bg-accent rounded-md border px-2 py-0.5 text-xs font-bold"
              >
                {sec}s
              </button>
            ))}
          </div>

          <div className="flex items-start gap-4">
            <NumberField
              name="autoAdvance.responsesDelay"
              label="game:settings.autoAdvance.responsesDelay"
              className="flex-1"
            />
            <NumberField
              name="autoAdvance.leaderboardDelay"
              label="game:settings.autoAdvance.leaderboardDelay"
              className="flex-1"
            />
          </div>
        </div>
      )}
    </>
  )
}

export default AutoAdvance
