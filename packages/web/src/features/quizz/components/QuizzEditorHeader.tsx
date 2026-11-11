import { QUIZZ_MODES } from "@razzia/common/constants"
import type { QuizzValidated } from "@razzia/common/validators/quizz"
import Button from "@razzia/web/components/Button"
import FieldError from "@razzia/web/components/forms/FieldError"
import Input from "@razzia/web/components/Input"
import ToggleGroup from "@razzia/web/components/ToggleGroup"
import {
  createQuizz,
  quizzKeys,
  updateQuizz,
} from "@razzia/web/features/manager/queries"
import {
  useQuizzEditor,
  type QuizzFormValues,
} from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { ApiError } from "@razzia/web/lib/api"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { Controller, useFormContext } from "react-hook-form"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const QUIZZ_MODE_LIST = Object.values(QUIZZ_MODES)

const QuizzEditorHeader = () => {
  const { quizzId, setCurrentIndex } = useQuizzEditor()
  const { handleSubmit, control } = useFormContext<
    QuizzFormValues,
    unknown,
    QuizzValidated
  >()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const handleExit = () => {
    navigate({ to: "/manager/config" })
  }

  const onError = (error: Error) => {
    toast.error(
      t(error instanceof ApiError ? error.key : "errors:quizz.failedToSave"),
    )
  }

  const onSaved = (messageKey: string) => {
    queryClient.invalidateQueries({ queryKey: quizzKeys.all })
    toast.success(t(messageKey))
    handleExit()
  }

  const { mutate: create } = useMutation({
    mutationFn: createQuizz,
    onSuccess: () => onSaved("quizz:quizzSaved"),
    onError,
  })

  const { mutate: update } = useMutation({
    mutationFn: updateQuizz,
    onSuccess: () => onSaved("quizz:quizzUpdated"),
    onError,
  })

  const handleSave = handleSubmit(
    (values) => {
      if (quizzId) {
        update({ id: quizzId, json: values })

        return
      }

      create(values)
    },
    (invalid) => {
      if (!Array.isArray(invalid.questions)) {
        return
      }

      const index = invalid.questions.findIndex(Boolean)

      if (index >= 0) {
        setCurrentIndex(index)
      }
    },
  )

  return (
    <header className="bg-background z-20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 md:gap-4 p-2.5 md:px-4 md:h-14 shadow-sm shrink-0">
      <div className="flex items-center justify-between gap-2 md:gap-4 flex-1 min-w-0">
        <Controller
          control={control}
          name="subject"
          render={({ field, fieldState }) => (
            <div className="flex items-center gap-2 flex-1 md:max-w-xs min-w-0">
              <Input
                {...field}
                variant="sm"
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid ? `${field.name}-error` : undefined
                }
                className={clsx(
                  "w-full",
                  fieldState.invalid && "ring-2 ring-red-500",
                )}
                placeholder={t("quizz:titleQuizzPlaceholder")}
              />
              <FieldError
                id={`${field.name}-error`}
                errors={[fieldState.error]}
              />
            </div>
          )}
        />

        <div className="hidden md:block">
          <Controller
            control={control}
            name="gameMode"
            render={({ field }) => (
              <ToggleGroup
                value={field.value}
                onChange={field.onChange}
                items={QUIZZ_MODE_LIST.map((gameMode) => ({
                  value: gameMode,
                  label: t(`quizz:gameMode.${gameMode}`),
                }))}
              />
            )}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="bg-accent text-accent-foreground font-semibold px-3 py-1.5"
            onClick={handleExit}
          >
            {t("common:exit")}
          </Button>
          <Button
            size="sm"
            className="bg-primary px-3 py-1.5"
            onClick={handleSave}
          >
            {t("common:save")}
          </Button>
        </div>
      </div>

      <div className="flex md:hidden items-center justify-center pt-1 border-t border-border/40">
        <Controller
          control={control}
          name="gameMode"
          render={({ field }) => (
            <ToggleGroup
              className="w-full justify-center"
              value={field.value}
              onChange={field.onChange}
              items={QUIZZ_MODE_LIST.map((gameMode) => ({
                value: gameMode,
                label: t(`quizz:gameMode.${gameMode}`),
              }))}
            />
          )}
        />
      </div>
    </header>
  )
}

export default QuizzEditorHeader
