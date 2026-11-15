import type { AntiCheatMode, GameSettings } from "@razzia/common/types/game"
import Switch from "@razzia/web/components/Switch"
import NumberField from "@razzia/web/components/forms/NumberField"
import SettingRow from "@razzia/web/features/game/components/GameSettingsModal/SettingRow"
import { Ban, MinusCircle } from "lucide-react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

const PENALTY_PRESETS = [100, 250, 500, 1000]

const AntiCheat = () => {
  const { control, setValue } = useFormContext<GameSettings>()
  const { t } = useTranslation()
  const enabled = useWatch({ control, name: "detectScreenSplit" })
  const mode = (useWatch({ control, name: "antiCheatMode" }) ?? "kick") as AntiCheatMode
  const penaltyPoints = useWatch({ control, name: "antiCheatPenaltyPoints" }) ?? 500

  const handleSelectMode = (newMode: AntiCheatMode) => {
    setValue("antiCheatMode", newMode, { shouldValidate: true })
  }

  const handlePresetPoints = (pts: number) => {
    setValue("antiCheatPenaltyPoints", pts, { shouldValidate: true })
  }

  return (
    <>
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

      {enabled && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl bg-primary/5 p-3.5 border border-primary/20">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-foreground">
              {t("game:settings.antiCheat.modeLabel")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectMode("kick")}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                  mode === "kick"
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                    : "border-border/60 hover:bg-accent bg-background"
                }`}
              >
                <Ban className="size-4 mt-0.5 text-red-500 shrink-0" />
                <div>
                  <div className="text-xs font-bold">
                    {t("game:settings.antiCheat.modeKick")}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {t("game:settings.antiCheat.modeKickHint")}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode("penalty")}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                  mode === "penalty"
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                    : "border-border/60 hover:bg-accent bg-background"
                }`}
              >
                <MinusCircle className="size-4 mt-0.5 text-amber-500 shrink-0" />
                <div>
                  <div className="text-xs font-bold">
                    {t("game:settings.antiCheat.modePenalty")}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {t("game:settings.antiCheat.modePenaltyHint")}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {mode === "penalty" && (
            <div className="mt-1 flex flex-col gap-2 pt-2 border-t border-border/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-foreground">
                  {t("game:settings.antiCheat.penaltyPoints")}
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                    Presets:
                  </span>
                  {PENALTY_PRESETS.map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => handlePresetPoints(pts)}
                      className={`rounded px-2 py-0.5 text-xs font-bold border transition-all ${
                        penaltyPoints === pts
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent border-border/60 text-foreground"
                      }`}
                    >
                      {pts}
                    </button>
                  ))}
                </div>
              </div>

              <Controller
                control={control}
                name="antiCheatPenaltyPoints"
                render={({ field }) => (
                  <NumberField
                    value={field.value ?? 500}
                    onChange={(val) => field.onChange(val || 0)}
                    min={1}
                    max={100000}
                  />
                )}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("game:settings.antiCheat.penaltyPointsHint")}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default AntiCheat
