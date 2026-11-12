import GameBackground from "@razzia/web/components/GameBackground"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import QuestionEditorAnswers from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorAnswers"
import QuestionEditorConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig"
import QuestionEditorMedia from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorMedia"
import QuestionEditorNote from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorNote"
import QuestionEditorTitle from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorTitle"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { SlidersHorizontal, Sparkles } from "lucide-react"
import { useState } from "react"

const QuestionEditor = () => {
  const { currentQuestion, currentQuestionId, isRemoving } = useQuizzEditor()
  const [mobileTab, setMobileTab] = useState<"question" | "config">("question")

  const AnswersEditor =
    QUESTION_REGISTRY[currentQuestion.type].AnswersEditor ??
    QuestionEditorAnswers

  if (isRemoving) {
    return null
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-w-0 min-h-0">
      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden items-center justify-center p-2 bg-background/90 backdrop-blur-sm border-b border-border/60 z-10 shrink-0">
        <div className="flex w-full max-w-sm rounded-lg bg-accent p-1">
          <button
            type="button"
            onClick={() => setMobileTab("question")}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-all",
              mobileTab === "question"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="size-3.5" />
            <span>Question</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("config")}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-all",
              mobileTab === "config"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Question Settings</span>
          </button>
        </div>
      </div>

      {/* Mobile Config View */}
      {mobileTab === "config" ? (
        <main className="mx-auto flex max-w-3xl w-full flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-6 min-w-0 min-h-0 lg:hidden">
          <QuestionEditorConfig inline />
          <GameBackground />
        </main>
      ) : null}

      {/* Main Question View */}
      <main
        className={clsx(
          "mx-auto flex max-w-7xl w-full flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-6 min-w-0 min-h-0",
          mobileTab === "config" && "hidden lg:flex",
        )}
      >
        <QuestionEditorTitle />
        <QuestionEditorMedia />
        <QuestionEditorNote />
        <AnswersEditor key={currentQuestionId} />

        <div className="block lg:hidden mt-2">
          <button
            type="button"
            onClick={() => setMobileTab("config")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:brightness-95 transition-all shadow-xs"
          >
            <SlidersHorizontal className="size-4" />
            <span>Edit Question Settings & Timings</span>
          </button>
        </div>

        <GameBackground />
      </main>

      {/* Desktop Config Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <QuestionEditorConfig />
      </div>
    </div>
  )
}

export default QuestionEditor
