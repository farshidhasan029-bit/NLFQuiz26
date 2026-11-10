import type { GameSettings } from "@razzia/common/types/game"
import Switch from "@razzia/web/components/Switch"
import SettingRow from "@razzia/web/features/game/components/GameSettingsModal/SettingRow"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

const AntiCheat = () => {
  const { control } = useFormContext<GameSettings>()
  const { t } = useTranslation()

  return (
    <Controller
      control={control}
      name="detectScreenSplit"
      render={({ field }) => (
        <SettingRow
          label="game:settings.antiCheat.label"
          hint="game:settings.antiCheat.hint"
        >
          <Switch
            aria-label={t("game:settings.antiCheat.label")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        </SettingRow>
      )}
    />
  )
}

export default AntiCheat
