import {
  exportBackup,
  restoreBackup,
} from "@razzia/web/features/manager/queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { jsPDF } from "jspdf"
import { Download, Upload } from "lucide-react"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

/** Convert the JSON backup bundle into a readable PDF report */
const bundleToPdf = (bundle: {
  version: number
  quizzes?: Array<{ subject?: string; questions?: unknown[] }>
  results?: Array<{
    subject?: string
    date?: string
    players?: Array<{ username?: string; points?: number; rank?: number }>
  }>
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  const usable = pageW - margin * 2
  let y = 18

  const checkPage = (needed = 10) => {
    if (y + needed > 278) {
      doc.addPage()
      y = 18
    }
  }

  // ── Header ────────────────────────────────────────────────
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, pageW, 12, "F")
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255)
  doc.text("NLF26 — Full Backup Report", margin, 8.5)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text(new Date().toLocaleString(), pageW - margin, 8.5, { align: "right" })
  y = 20

  // ── Quizzes section ───────────────────────────────────────
  const quizzes = bundle.quizzes ?? []
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(40)
  doc.text(`📚 Quizzes (${quizzes.length})`, margin, y)
  y += 2
  doc.setDrawColor(79, 70, 229)
  doc.setLineWidth(0.5)
  doc.line(margin, y, margin + usable, y)
  y += 5

  if (quizzes.length === 0) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(150)
    doc.text("No quizzes found.", margin, y)
    y += 8
  }

  for (const [qi, quiz] of quizzes.entries()) {
    checkPage(12)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(79, 70, 229)
    doc.text(`${qi + 1}. ${quiz.subject ?? "Untitled Quiz"}`, margin, y)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100)
    doc.text(`${(quiz.questions ?? []).length} question(s)`, pageW - margin, y, { align: "right" })
    y += 7
  }
  y += 4

  // ── Results section ───────────────────────────────────────
  const results = bundle.results ?? []
  checkPage(14)
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(40)
  doc.text(`🏆 Results (${results.length})`, margin, y)
  y += 2
  doc.setDrawColor(79, 70, 229)
  doc.line(margin, y, margin + usable, y)
  y += 5

  if (results.length === 0) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(150)
    doc.text("No results found.", margin, y)
    y += 8
  }

  for (const [ri, result] of results.entries()) {
    const players = result.players ?? []
    checkPage(16 + Math.min(players.length, 5) * 7)

    // Result header
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(40)
    doc.text(`${ri + 1}. ${result.subject ?? "Untitled"}`, margin, y)
    if (result.date) {
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(120)
      doc.text(new Date(result.date).toLocaleString(), pageW - margin, y, { align: "right" })
    }
    y += 5

    // Top 5 players
    if (players.length > 0) {
      const colW = [14, 90, 28, 22]
      const headers = ["Rank", "Name", "Score (pts)", ""]
      doc.setFillColor(50, 50, 50)
      doc.rect(margin, y, usable, 6, "F")
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(255)
      let xc = margin
      headers.forEach((h, i) => {
        doc.text(h, xc + colW[i] / 2, y + 4, { align: "center" })
        xc += colW[i]
      })
      y += 6

      const sorted = [...players].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
      for (const [pi, p] of sorted.slice(0, 5).entries()) {
        const even = pi % 2 === 0
        doc.setFillColor(even ? 255 : 248, even ? 255 : 248, even ? 255 : 252)
        doc.rect(margin, y, usable, 6, "F")
        doc.setFontSize(7)
        doc.setFont("helvetica", pi === 0 ? "bold" : "normal")
        doc.setTextColor(pi === 0 ? 160 : 60, pi === 0 ? 100 : 60, 0)
        const cells = [`#${p.rank ?? pi + 1}`, p.username ?? "—", `${p.points ?? 0}`]
        xc = margin
        cells.forEach((cell, i) => {
          const txt = i === 1 ? doc.splitTextToSize(cell, colW[i] - 2)[0] : cell
          doc.text(txt, xc + colW[i] / 2, y + 4, { align: "center" })
          xc += colW[i]
        })
        y += 6
      }
      if (players.length > 5) {
        doc.setFontSize(7)
        doc.setFont("helvetica", "italic")
        doc.setTextColor(130)
        doc.text(`… and ${players.length - 5} more participants`, margin, y + 4)
        y += 6
      }
    }
    y += 6
  }

  // ── Footer ────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(160)
    doc.setFont("helvetica", "normal")
    doc.text(
      `NLF26 Backup Report · ${new Date().toLocaleDateString()} · Page ${p} of ${totalPages}`,
      pageW / 2,
      291,
      { align: "center" },
    )
  }

  return doc
}

const ConfigBackup = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)

  const { mutate: doExport, isPending: exporting } = useMutation({
    mutationFn: exportBackup,
    onSuccess: async (blob) => {
      try {
        const bundle = JSON.parse(await blob.text())
        const doc = bundleToPdf(bundle)
        const filename = `nlfquiz-backup-${new Date().toISOString().slice(0, 10)}.pdf`
        doc.save(filename)
        toast.success(t("manager:backup.exportSuccess"))
      } catch {
        toast.error(t("manager:backup.exportError"))
      }
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
    e.target.value = ""
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Export — PDF */}
      <div className="rounded-xl border p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Download className="size-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold">{t("manager:backup.exportTitle")}</h3>
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary tracking-wide uppercase">
            PDF
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Download a{" "}
          <span className="font-semibold text-foreground">PDF report</span> of all your quizzes
          and results.{" "}
          <span className="rounded bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 font-semibold text-amber-700 dark:text-amber-300 text-[11px]">
            To restore data, use the JSON file format below ↓
          </span>
        </p>
        <button
          onClick={() => doExport()}
          disabled={exporting}
          className="mt-1 self-start inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Download className="size-3.5" />
          {exporting ? t("manager:backup.exporting") : "Download PDF Report"}
        </button>
      </div>

      {/* Restore */}
      <div className="rounded-xl border p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Upload className="size-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold">{t("manager:backup.restoreTitle")}</h3>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground tracking-wide uppercase">
            JSON
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Upload a{" "}
          <span className="font-semibold text-foreground">backup JSON file</span> to restore your
          quizzes and results.{" "}
          <span className="rounded bg-green-100 dark:bg-green-900/40 px-1 py-0.5 font-semibold text-green-700 dark:text-green-400 text-[11px]">
            Existing data is kept — only new items are added
          </span>
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
          className="mt-1 self-start inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <Upload className="size-3.5" />
          {restoring ? t("manager:backup.restoring") : t("manager:backup.restoreBtn")}
        </button>
        {restoreMsg && (
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">{restoreMsg}</p>
        )}
      </div>
    </div>
  )
}

export default ConfigBackup
