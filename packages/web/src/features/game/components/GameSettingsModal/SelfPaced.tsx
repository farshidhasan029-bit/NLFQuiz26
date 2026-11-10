import type { GameSettings } from "@razzia/common/types/game"
import Switch from "@razzia/web/components/Switch"
import SettingRow from "@razzia/web/features/game/components/GameSettingsModal/SettingRow"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

const SelfPaced = () => {
  const { control } = useFormContext<GameSettings>()
  const { t } = useTranslation()

  return (
    <Controller
      control={control}
      name="selfPaced"
      render={({ field }) => (
        <SettingRow
          label="game:settings.selfPaced.label"
          hint="game:settings.selfPaced.hint"
        >
          <Switch
            aria-label={t("game:settings.selfPaced.label")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        </SettingRow>
      )}
    />
  )
}

export default SelfPaced
