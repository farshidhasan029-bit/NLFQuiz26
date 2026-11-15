import AlertDialog from "@razzia/web/components/AlertDialog"
import { SkeletonRows } from "@razzia/web/components/Skeleton"
import ResultModal from "@razzia/web/features/manager/components/ResultModal"
import {
  deleteResult,
  resultKeys,
  resultQuery,
  resultsListQuery,
} from "@razzia/web/features/manager/queries"
import { ApiError } from "@razzia/web/lib/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2, Trophy } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const formatDate = (iso: string) => {
  const d = new Date(iso)

  return `${d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

const ConfigResults = () => {
  const { data, isPending } = useQuery(resultsListQuery())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const { data: selectedResult } = useQuery({
    ...resultQuery(selectedId ?? ""),
    enabled: Boolean(selectedId),
  })

  const { mutate: remove } = useMutation({
    mutationFn: deleteResult,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resultKeys.all })
      toast.success(t("manager:result.deleted"))
    },
    onError: (error) => {
      toast.error(
        t(error instanceof ApiError ? error.key : "errors:result.notFound"),
      )
    },
  })

  if (isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-2 p-0.5">
          <SkeletonRows className="h-14" />
        </div>
      </div>
    )
  }

  const results = data?.results ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {results.map((r) => (
          <div
            key={r.id}
            className="border-accent flex min-h-16 w-full items-center justify-between rounded-md border-2 p-3 gap-2"
          >
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => setSelectedId(r.id)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-foreground truncate font-medium">
                  {r.subject}
                </p>
                {r.winnerName && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <Trophy className="size-3 shrink-0" />
                    <span>{r.winnerName}</span>
                    {typeof r.topScore === "number" && (
                      <span className="opacity-80">({r.topScore} pts)</span>
                    )}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">
                {formatDate(r.date)} -{" "}
                {t("manager:result.playerCount", { count: r.playerCount })}
              </p>
            </button>
            <AlertDialog
              trigger={
                <button
                  className="ml-2 shrink-0 rounded-sm p-2 hover:bg-red-600/10"
                  title={t("manager:result.delete")}
                >
                  <Trash2 className="size-4 stroke-red-500" />
                </button>
              }
              title={t("manager:result.delete")}
              description={t("manager:result.deleteConfirm", {
                name: r.subject,
              })}
              confirmLabel={t("common:delete")}
              onConfirm={() => remove(r.id)}
            />
          </div>
        ))}

        {results.length === 0 && (
          <p className="text-muted-foreground my-8 text-center">
            {t("manager:result.none")}
          </p>
        )}
      </div>

      {selectedId && selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

export default ConfigResults
