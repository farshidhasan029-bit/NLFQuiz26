import type { GameSettings } from "@razzia/common/types/game"
import Switch from "@razzia/web/components/Switch"
import SettingRow from "@razzia/web/features/game/components/GameSettingsModal/SettingRow"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

const PauseOnDisconnect = () => {
  const { control } = useFormContext<GameSettings>()
  const { t } = useTranslation()

  return (
    <Controller
      control={control}
      name="pauseOnDisconnect"
      render={({ field }) => (
        <SettingRow
          label="game:settings.pauseOnDisconnect.label"
          hint="game:settings.pauseOnDisconnect.hint"
        >
          <Switch
            aria-label={t("game:settings.pauseOnDisconnect.label")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        </SettingRow>
      )}
    />
  )
}

export default PauseOnDisconnect
