import type { GameSettings } from "@razzia/common/types/game"
import Switch from "@razzia/web/components/Switch"
import SettingRow from "@razzia/web/features/game/components/GameSettingsModal/SettingRow"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

const HidePlayerResults = () => {
  const { control } = useFormContext<GameSettings>()
  const { t } = useTranslation()

  return (
    <Controller
      control={control}
      name="hidePlayerResults"
      render={({ field }) => (
        <SettingRow
          label="game:settings.hidePlayerResults.label"
          hint="game:settings.hidePlayerResults.hint"
        >
          <Switch
            aria-label={t("game:settings.hidePlayerResults.label")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        </SettingRow>
      )}
    />
  )
}

export default HidePlayerResults
