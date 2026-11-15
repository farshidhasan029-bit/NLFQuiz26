import { EVENTS } from "@razzia/common/constants"
import type { ResultQueryRequest } from "@razzia/common/types/game"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import clsx from "clsx"
import { Check, ChevronDown, ChevronUp, FileText, User, X } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const HostResultQueries = () => {
  const { gameId } = useManagerStore()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const [requests, setRequests] = useState<ResultQueryRequest[]>([])
  const [isExpanded, setIsExpanded] = useState(true)

  useEvent(EVENTS.MANAGER.RESULT_REQUESTS_UPDATE, (newRequests) => {
    setRequests(newRequests)
    if (newRequests.length > 0) {
      setIsExpanded(true)
    }
  })

  if (requests.length === 0) {
    return null
  }

  const handleRespond = (playerId: string, approved: boolean, username: string) => {
    if (!gameId) return
    socket.emit(EVENTS.MANAGER.RESPOND_RESULT_REQUEST, {
      gameId,
      playerId,
      approved,
    })
    if (approved) {
      toast.success(t("game:hostResultAllowedSingle", { name: username }))
    } else {
      toast(t("game:hostResultDeniedSingle", { name: username }))
    }
  }

  const handleAllowAll = () => {
    if (!gameId) return
    socket.emit(EVENTS.MANAGER.RESPOND_RESULT_REQUEST, {
      gameId,
      allowAll: true,
      approved: true,
    })
    toast.success(t("game:hostResultAllowedAll"))
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm px-2 sm:px-0">
      <div className="overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-slate-900/95 shadow-2xl backdrop-blur-xl text-white">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-gradient-to-r from-amber-500/20 to-transparent">
          <div className="flex items-center gap-2">
            <div className="relative flex size-8 items-center justify-center rounded-xl bg-amber-500 text-black shadow">
              <FileText className="size-4" />
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white animate-pulse">
                {requests.length}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">
                {t("game:hostResultQueriesTitle")}
              </p>
              <p className="text-[11px] text-white/70">
                {t("game:hostResultQueriesSubtitle", { count: requests.length })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronUp className="size-4" />
              )}
            </button>
          </div>
        </div>

        {/* Content body */}
        {isExpanded && (
          <div className="flex flex-col p-3 gap-2 max-h-72 overflow-y-auto">
            {requests.length > 1 && (
              <button
                onClick={handleAllowAll}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-3 py-2 text-xs font-bold text-black shadow transition-all active:scale-98"
              >
                <Check className="size-4 stroke-3" />
                {t("game:hostResultAllowAllBtn", { count: requests.length })}
              </button>
            )}

            <div className="flex flex-col gap-1.5 divide-y divide-white/5">
              {requests.map((r) => (
                <div
                  key={r.playerId}
                  className="flex items-center justify-between gap-2 pt-2 first:pt-0"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
                      <User className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-white">
                        {r.username}
                      </p>
                      <p className="text-[10px] text-white/60">
                        {t("game:hostResultQueryPrompt")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRespond(r.playerId, true, r.username)}
                      title={t("game:hostResultAllowBtn")}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-2.5 py-1 text-xs font-bold text-emerald-300 transition-colors"
                    >
                      <Check className="size-3.5 stroke-3" />
                      {t("game:hostResultAllowBtn")}
                    </button>
                    <button
                      onClick={() => handleRespond(r.playerId, false, r.username)}
                      title={t("game:hostResultDenyBtn")}
                      className="rounded-lg p-1 text-white/50 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HostResultQueries
