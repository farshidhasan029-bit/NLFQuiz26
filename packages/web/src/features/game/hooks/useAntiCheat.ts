import type { AntiCheatMode } from "@razzia/common/types/game"
import { EVENTS } from "@razzia/common/constants"
import { STATUS, type Status } from "@razzia/common/types/game/status"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useEffect, useRef } from "react"

interface AntiCheatOptions {
  enabled: boolean
  gameId: string | null
  statusName: Status | undefined
  mode?: AntiCheatMode
}

// If the window is narrower than 75% of the screen, it's split-screened
const SPLIT_SCREEN_WIDTH_RATIO = 0.75
// If the window is shorter than 65% of the screen, it's vertically split
const SPLIT_SCREEN_HEIGHT_RATIO = 0.65
// Short debounce for blur/focus to avoid false positives from click events
const BLUR_DEBOUNCE_MS = 300
// Cooldown between successive penalty reports (penalty mode only)
const PENALTY_COOLDOWN_MS = 7000
// Grace after first entering a guarded state (let the UI settle)
const GUARDED_ENTRY_GRACE_MS = 1500
// Grace after returning to the tab (let socket reconnect)
const RETURN_GRACE_MS = 2000

// States where cheating detection is NOT active
const UNGUARDED: Set<Status> = new Set([
  STATUS.SHOW_ROOM,
  STATUS.SHOW_START,
  STATUS.SHOW_PREPARED,
  STATUS.FINISHED,
  STATUS.SUMMARY,
  STATUS.WAIT,
])

function isGuardedStatus(s: Status | undefined, gameId: string | null): boolean {
  if (!s) return false
  if (UNGUARDED.has(s)) return false
  if (typeof localStorage !== "undefined" && gameId) {
    if (localStorage.getItem(`quiz_submitted_${gameId}`) === "true") return false
  }
  return true
}

export const useAntiCheat = ({
  enabled,
  gameId,
  statusName,
  mode = "kick",
}: AntiCheatOptions) => {
  const { socket } = useSocket()

  // ── Persistent refs (survive status transitions) ──────────────────────────
  const reportedRef        = useRef(false)              // kick mode: reported once
  const lastPenaltyAtRef   = useRef(0)                  // penalty mode: cooldown
  const guardedSinceRef    = useRef<number | null>(null) // when we entered guarded state
  const returnGraceUntilRef = useRef(0)                 // grace after returning to tab
  const blurTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  // If the socket was offline when a violation fired, store it here and
  // flush it the next time the socket reconnects and the page is visible.
  const pendingViolationRef = useRef<string | null>(null)

  // Latest-value refs so event callbacks read current state without re-registering
  const enabledRef    = useRef(enabled)
  const gameIdRef     = useRef(gameId)
  const statusRef     = useRef(statusName)
  const modeRef       = useRef(mode)

  useEffect(() => { enabledRef.current    = enabled    }, [enabled])
  useEffect(() => { gameIdRef.current     = gameId     }, [gameId])
  useEffect(() => { modeRef.current       = mode       }, [mode])

  // Track guarded ↔ unguarded transitions
  useEffect(() => {
    statusRef.current = statusName
    const guarded = isGuardedStatus(statusName, gameId)

    if (guarded && guardedSinceRef.current === null) {
      guardedSinceRef.current = Date.now()
    } else if (!guarded) {
      guardedSinceRef.current = null
      if (blurTimerRef.current) { clearTimeout(blurTimerRef.current); blurTimerRef.current = null }
    }
  }, [statusName, gameId])

  // Main effect — register listeners ONCE per mount (not on every status change)
  useEffect(() => {
    if (!enabled || !gameId) return

    // ── Core helpers ───────────────────────────────────────────────────────
    const currentlyGuarded = () =>
      enabledRef.current && isGuardedStatus(statusRef.current, gameIdRef.current)

    const flushPendingViolation = () => {
      const reason = pendingViolationRef.current
      if (!reason || !socket.connected) return
      if (!currentlyGuarded()) { pendingViolationRef.current = null; return }
      pendingViolationRef.current = null
      socket.emit(EVENTS.PLAYER.CHEATING_DETECTED, { gameId: gameIdRef.current, reason })
    }

    const reportViolation = (reason: string) => {
      if (!currentlyGuarded()) return

      // Grace period after first entering guarded state (allow layout settle)
      const since = guardedSinceRef.current
      if (since === null || Date.now() - since < GUARDED_ENTRY_GRACE_MS) return

      // Grace period after returning to the tab (let socket reconnect)
      if (Date.now() < returnGraceUntilRef.current) return

      const mode = modeRef.current
      if (mode === "penalty") {
        if (Date.now() - lastPenaltyAtRef.current < PENALTY_COOLDOWN_MS) return
      } else {
        // kick mode: only report once per session
        if (reportedRef.current) return
      }

      // If the socket is offline (tab was hidden long enough to disconnect),
      // store the violation and flush it once the socket reconnects.
      if (!socket.connected) {
        pendingViolationRef.current = reason
        return
      }

      if (mode === "penalty") {
        lastPenaltyAtRef.current = Date.now()
      } else {
        reportedRef.current = true
      }

      socket.emit(EVENTS.PLAYER.CHEATING_DETECTED, { gameId: gameIdRef.current, reason })
      // Also queue it in case the emit doesn't reach the server
      pendingViolationRef.current = reason
      // Clear the pending ref after a short delay (assume delivered)
      setTimeout(() => {
        if (pendingViolationRef.current === reason) pendingViolationRef.current = null
      }, 2000)
    }

    const isTyping = () => {
      if (typeof document === "undefined") return false
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName.toLowerCase()
      return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable
    }

    const checkSplitScreen = () => {
      if (!currentlyGuarded()) return
      if (Date.now() < returnGraceUntilRef.current) return

      const sw = window.screen.availWidth  || window.screen.width
      const sh = window.screen.availHeight || window.screen.height

      if (sw > 0 && window.innerWidth / sw < SPLIT_SCREEN_WIDTH_RATIO) {
        reportViolation("screen_split"); return
      }
      if (sh > 0 && !isTyping() && window.innerHeight / sh < SPLIT_SCREEN_HEIGHT_RATIO) {
        reportViolation("screen_split")
      }
    }

    // ── Periodic checker (runs every 2s) ───────────────────────────────────
    const intervalId = setInterval(() => {
      if (!currentlyGuarded()) return
      if (typeof document === "undefined") return

      if (document.visibilityState === "hidden") {
        // Tab is hidden — report violation immediately (may queue if offline)
        reportViolation("tab_switch")
        return
      }

      // Flush any violation that couldn't be sent while offline
      flushPendingViolation()
      checkSplitScreen()
    }, 2000)

    // ── Resize ─────────────────────────────────────────────────────────────
    const onResize = () => checkSplitScreen()

    // ── Blur ───────────────────────────────────────────────────────────────
    // Window blur fires when the user switches app/window (not on element focus changes)
    const onBlur = () => {
      if (!currentlyGuarded()) return

      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)

      // Short debounce to avoid false positives from OS-level blur/focus flickers
      blurTimerRef.current = setTimeout(() => {
        blurTimerRef.current = null
        if (!currentlyGuarded()) return
        if (typeof document === "undefined") return
        // Confirm the window/tab is genuinely not focused
        if (!document.hasFocus() || document.visibilityState === "hidden") {
          reportViolation(
            document.visibilityState === "hidden" ? "tab_switch" : "window_blur"
          )
        }
      }, BLUR_DEBOUNCE_MS)
    }

    // ── Focus ──────────────────────────────────────────────────────────────
    const onFocus = () => {
      if (blurTimerRef.current) { clearTimeout(blurTimerRef.current); blurTimerRef.current = null }

      returnGraceUntilRef.current = Date.now() + RETURN_GRACE_MS

      // Flush pending violation now that socket should be reconnected
      setTimeout(flushPendingViolation, 1000)
    }

    // ── Visibility change ──────────────────────────────────────────────────
    const onVisibilityChange = () => {
      if (typeof document === "undefined") return

      if (document.visibilityState === "visible") {
        if (blurTimerRef.current) { clearTimeout(blurTimerRef.current); blurTimerRef.current = null }

        returnGraceUntilRef.current = Date.now() + RETURN_GRACE_MS

        // Give the socket ~1.5s to reconnect, then flush any stored violation
        setTimeout(flushPendingViolation, 1500)
        return
      }

      if (!currentlyGuarded()) return

      // Tab became hidden — report violation immediately
      if (document.visibilityState === "hidden") {
        reportViolation("tab_switch")
      }
    }

    // ── Page hide (mobile app switching) ──────────────────────────────────
    const onPageHide = () => {
      if (!currentlyGuarded()) return
      reportViolation("tab_switch")
    }

    // ── Socket reconnect: flush pending violation ──────────────────────────
    const onSocketConnect = () => {
      setTimeout(flushPendingViolation, 500)
    }

    // ── Register ───────────────────────────────────────────────────────────
    window.addEventListener("resize",           onResize)
    window.addEventListener("blur",             onBlur)
    window.addEventListener("focus",            onFocus)
    window.addEventListener("pagehide",         onPageHide)
    document.addEventListener("visibilitychange", onVisibilityChange)
    socket.on("connect", onSocketConnect)

    return () => {
      clearInterval(intervalId)
      if (blurTimerRef.current) { clearTimeout(blurTimerRef.current); blurTimerRef.current = null }
      window.removeEventListener("resize",             onResize)
      window.removeEventListener("blur",               onBlur)
      window.removeEventListener("focus",              onFocus)
      window.removeEventListener("pagehide",           onPageHide)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      socket.off("connect", onSocketConnect)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameId, socket])
}
