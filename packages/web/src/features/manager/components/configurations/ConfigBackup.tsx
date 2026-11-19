import {
  exportBackup,
  restoreBackup,
} from "@razzia/web/features/manager/queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, Upload } from "lucide-react"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ConfigBackup = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)

  const { mutate: doExport, isPending: exporting } = useMutation({
    mutationFn: exportBackup,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `nlfquiz-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t("manager:backup.exportSuccess"))
    },
    onError: () => toast.error(t("manager:backup.exportError")),
  })

  const { mutate: doRestore, isPending: restoring } = useMutation({
    mutationFn: restoreBackup,
    onSuccess: ({ quizzCount, resultCount }) => {
      queryClient.invalidateQueries()
      const msg = t("manager:backup.restoreSuccess", { quizzCount, resultCount })
      setRestoreMsg(msg)
      toast.success(msg)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bundle = JSON.parse(evt.target?.result as string)
        doRestore(bundle)
      } catch {
        toast.error(t("manager:backup.invalidFile"))
      }
    }
    reader.readAsText(file)
    // reset so the same file can be re-selected
    e.target.value = ""
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Export */}
      <div className="rounded-xl border p-4 flex flex-col gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Download className="size-4" />
          {t("manager:backup.exportTitle")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("manager:backup.exportDesc")}
        </p>
        <button
          onClick={() => doExport()}
          disabled={exporting}
          className="mt-1 self-start rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {exporting ? t("manager:backup.exporting") : t("manager:backup.exportBtn")}
        </button>
      </div>

      {/* Restore */}
      <div className="rounded-xl border p-4 flex flex-col gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Upload className="size-4" />
          {t("manager:backup.restoreTitle")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("manager:backup.restoreDesc")}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={restoring}
          className="mt-1 self-start rounded-lg border border-primary px-4 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {restoring ? t("manager:backup.restoring") : t("manager:backup.restoreBtn")}
        </button>
        {restoreMsg && (
          <p className="text-xs text-green-600 dark:text-green-400">{restoreMsg}</p>
        )}
      </div>
    </div>
  )
}

export default ConfigBackup
