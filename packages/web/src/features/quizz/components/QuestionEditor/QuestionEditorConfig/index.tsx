import { QUIZZ_MODES } from "@razzia/common/constants"
import type { QuestionType } from "@razzia/common/types/game"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@razzia/web/components/Select"
import {
  QUESTION_REGISTRY,
  QUESTION_TYPE_LIST,
} from "@razzia/web/features/questions"
import CategoryField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/CategoryField"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { LayoutList } from "lucide-react"
import { useTranslation } from "react-i18next"

interface Props {
  inline?: boolean
}

const QuestionEditorConfig = ({ inline = false }: Props) => {
  const {
    currentQuestion,
    currentQuestionId,
    currentIndex,
    gameMode,
    updateQuestion,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const questionType = currentQuestion.type

  const handleTypeChange = (nextType: QuestionType) => {
    const { defaultOptions, initialValues } = QUESTION_REGISTRY[nextType]

    updateQuestion(currentIndex, {
      type: nextType,
      options: defaultOptions,
      ...initialValues(currentQuestion),
    })
  }

  const { ConfigComponent } = QUESTION_REGISTRY[questionType]

  const typeOptions = QUESTION_TYPE_LIST.map((type) => ({
    value: type,
    label: t(QUESTION_REGISTRY[type].labelKey),
  }))

  return (
    <aside
      className={clsx(
        "bg-background z-10 flex flex-col gap-3 rounded-xl p-4 shadow-sm",
        inline
          ? "w-full border border-border/60"
          : "m-3 max-h-[calc(100%-1.5rem)] w-68 shrink-0 self-start overflow-y-auto",
      )}
    >
      <ConfigField>
        <ConfigField.Label
          icon={<LayoutList className="size-4" />}
          label={t("quizz:question.config.answerMode")}
        />
        <Select value={questionType} onValueChange={handleTypeChange}>
          <SelectTrigger aria-label={t("quizz:question.config.answerMode")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ConfigField>

      {gameMode === QUIZZ_MODES.QUIZ && <CategoryField />}

      <ConfigComponent key={currentQuestionId} />
    </aside>
  )
}

export default QuestionEditorConfig
