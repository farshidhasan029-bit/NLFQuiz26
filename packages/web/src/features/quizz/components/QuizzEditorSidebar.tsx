import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  restrictToFirstScrollableAncestor,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import QuizzEditorCard from "@razzia/web/features/quizz/components/QuizzEditorCard"
import type { Question } from "@razzia/common/types/game"
import {
  useQuizzEditor,
  type QuizzFormValues,
} from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Plus, Trash2 } from "lucide-react"
import { useRef } from "react"
import { useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

interface SortableItemProps {
  id: string
  question: Question
  index: number
  isActive: boolean
  isInvalid: boolean
  canDelete: boolean
  onClick: () => void
  onDelete: () => void
}

const SortableItem = ({
  id,
  question,
  index,
  isActive,
  isInvalid,
  canDelete,
  onClick,
  onDelete,
}: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={clsx(isDragging && "shadow-lg")}
    >
      <QuizzEditorCard
        question={question}
        index={index}
        isActive={isActive}
        isInvalid={isInvalid}
        canDelete={canDelete}
        onClick={onClick}
        onDelete={onDelete}
      />
    </div>
  )
}

const QuizzEditorSidebar = () => {
  const {
    questions,
    questionIds,
    currentIndex,
    setCurrentIndex,
    addQuestion,
    removeQuestion,
    reorderQuestions,
  } = useQuizzEditor()
  const {
    formState: { errors },
  } = useFormContext<QuizzFormValues>()
  const { t } = useTranslation()

  const isDragging = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleSlideClick = (index: number) => () => {
    if (!isDragging.current) {
      setCurrentIndex(index)
    }
  }

  const handleDelete = (index: number) => () => {
    removeQuestion(index)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    isDragging.current = false
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const from = questionIds.findIndex((id) => id === active.id)
    const to = questionIds.findIndex((id) => id === over.id)
    reorderQuestions(from, to)
  }

  return (
    <>
      {/* Mobile Horizontal Question Bar */}
      <div className="bg-background border-b border-border z-10 flex lg:hidden items-center justify-between gap-2 px-3 py-2 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-[calc(100%-140px)]">
          {questions.map((question, index) => {
            const isActive = currentIndex === index
            const isInvalid = Boolean(errors.questions?.[index])

            return (
              <button
                key={questionIds[index]}
                type="button"
                onClick={handleSlideClick(index)}
                className={clsx(
                  "relative flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all",
                  isActive
                    ? "bg-primary text-white shadow-sm ring-2 ring-primary ring-offset-1"
                    : "bg-accent text-accent-foreground hover:brightness-95",
                  isInvalid && "ring-2 ring-red-500",
                )}
              >
                {index + 1}
                {isInvalid && (
                  <span className="absolute -top-1 -right-1 size-2 rounded-full bg-red-500" />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {questions.length > 1 && (
            <AlertDialog
              trigger={
                <button
                  type="button"
                  aria-label={t("quizz:question.deleteQuestion")}
                  className="bg-accent text-accent-foreground hover:bg-red-50 hover:text-red-500 flex size-8 items-center justify-center rounded-lg transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              }
              title={t("quizz:question.deleteQuestion")}
              description={t("quizz:question.deleteQuestionConfirm")}
              confirmLabel={t("common:delete")}
              onConfirm={handleDelete(currentIndex)}
            />
          )}

          <Button
            size="sm"
            onClick={addQuestion}
            className="bg-accent text-accent-foreground flex items-center gap-1 text-xs px-2.5 py-1.5 font-semibold"
          >
            <Plus className="size-4" />
            <span>{t("quizz:addQuestion")}</span>
          </Button>
        </div>
      </div>

      {/* Desktop Vertical Sidebar */}
      <aside className="bg-background z-10 m-3 hidden lg:flex w-72 shrink-0 flex-col gap-2 overflow-auto rounded-xl p-3 shadow-sm">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          onDragStart={() => {
            isDragging.current = true
          }}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questionIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {questions.map((question, index) => (
                <SortableItem
                  key={questionIds[index]}
                  id={questionIds[index]}
                  question={question}
                  index={index}
                  isActive={currentIndex === index}
                  isInvalid={Boolean(errors.questions?.[index])}
                  canDelete={questions.length > 1}
                  onClick={handleSlideClick(index)}
                  onDelete={handleDelete(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Button
          onClick={addQuestion}
          className="bg text-md bg-accent text-accent-foreground mt-1 mb-8 flex items-center justify-center gap-1"
        >
          <Plus className="size-6" />
          {t("quizz:addQuestion")}
        </Button>
      </aside>
    </>
  )
}

export default QuizzEditorSidebar
