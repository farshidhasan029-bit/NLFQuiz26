import { useResultModal } from "@razzia/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useTranslation } from "react-i18next"

const ResultModalHeader = () => {
  const {
    result,
    questionIndex,
    total,
    goNext,
    goPrev,
    onClose,
    viewMode,
    setViewMode,
  } = useResultModal()
  const { t } = useTranslation()

  return (
    <div className="border-accent flex shrink-0 flex-col gap-2 border-b-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <h2 className="text-foreground truncate text-base font-bold">
          {result.subject}
        </h2>
        <button
          onClick={onClose}
          title={t("common:close")}
          className="text-muted-foreground hover:bg-muted hover:text-accent-foreground rounded p-1 sm:hidden"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        {/* View mode toggle */}
        <div className="bg-muted inline-flex items-center rounded-lg p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode("overall")}
            className={clsx(
              "rounded-md px-2.5 py-1 transition-colors",
              viewMode === "overall"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            🏆 {t("manager:result.overallEvaluation")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("questions")}
            className={clsx(
              "rounded-md px-2.5 py-1 transition-colors",
              viewMode === "questions"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            📋 {t("manager:result.questionBreakdown")}
          </button>
        </div>

        {/* Question controls only shown in questions breakdown view */}
        {viewMode === "questions" && (
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-muted-foreground text-xs">
              {questionIndex + 1}
              {t("manager:result.paginationOf")}
              {total}
            </span>
            <button
              type="button"
              disabled={questionIndex === 0}
              onClick={goPrev}
              title={t("common:previous")}
              className="text-muted-foreground hover:bg-muted rounded p-1 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={questionIndex === total - 1}
              onClick={goNext}
              title={t("common:next")}
              className="text-muted-foreground hover:bg-muted rounded p-1 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          title={t("common:close")}
          className="text-muted-foreground hover:bg-muted hover:text-accent-foreground ml-1 hidden rounded p-1 sm:block"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  )
}

export default ResultModalHeader
