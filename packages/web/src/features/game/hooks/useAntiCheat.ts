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

// If the window is narrower than 70% of the screen, it's split-screened
const SPLIT_SCREEN_WIDTH_RATIO = 0.7
// If the window is shorter than 60% of the screen, it's vertically split
const SPLIT_SCREEN_HEIGHT_RATIO = 0.60
// Idle time before we treat a hide as an auto-lock (not intentional switch)
const AUTO_LOCK_IDLE_MS = 4000
// Grace period before flagging an intentional switch as a violation
const SWITCH_GRACE_MS = 4000
// Cooldown between successive penalty reports (penalty mode only)
const PENALTY_COOLDOWN_MS = 7000

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
  const lastInteractionRef = useRef(Date.now())
  const isLockedRef        = useRef(false)              // device screen auto-locked
  const wakeGraceUntilRef  = useRef(0)                  // grace after waking
  const switchTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef        = useRef<any>(null)
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
      guardedSinceRef.current  = Date.now()
      lastInteractionRef.current = Date.now()
      isLockedRef.current      = false
    } else if (!guarded) {
      guardedSinceRef.current  = null
      // Cancel any pending violation timer when leaving a guarded state
      if (switchTimerRef.current) { clearTimeout(switchTimerRef.current); switchTimerRef.current = null }
      if (blurTimerRef.current)   { clearTimeout(blurTimerRef.current);   blurTimerRef.current   = null }
    }
  }, [statusName, gameId])

  // Main effect — register listeners ONCE per mount (not on every status change)
  useEffect(() => {
    if (!enabled || !gameId) return

    // ── Wake Lock ──────────────────────────────────────────────────────────
    const acquireWakeLock = async () => {
      if (typeof navigator === "undefined" || !("wakeLock" in navigator) || wakeLockRef.current) return
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
        wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null })
      } catch { /* battery saver / permission denied */ }
    }

    const releaseWakeLock = async () => {
      if (!wakeLockRef.current) return
      try { await wakeLockRef.current.release() } catch { /* ignore */ }
      wakeLockRef.current = null
    }

    acquireWakeLock()

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

      const mode = modeRef.current
      if (mode === "penalty") {
        if (Date.now() - lastPenaltyAtRef.current < PENALTY_COOLDOWN_MS) return
      } else {
        if (reportedRef.current) return
      }

      // Grace period after first entering guarded state (allow layout settle)
      const since = guardedSinceRef.current
      if (since === null || Date.now() - since < 1500) return

      // Grace period after screen wake / unlock
      if (Date.now() < wakeGraceUntilRef.current) return

      // Never report during an auto-lock
      if (isLockedRef.current) return

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
      if (isLockedRef.current || Date.now() < wakeGraceUntilRef.current) return

      const sw = window.screen.availWidth  || window.screen.width
      const sh = window.screen.availHeight || window.screen.height

      if (sw > 0 && window.innerWidth / sw < SPLIT_SCREEN_WIDTH_RATIO) {
        reportViolation("screen_split"); return
      }
      if (sh > 0 && !isTyping() && window.innerHeight / sh < SPLIT_SCREEN_HEIGHT_RATIO) {
        reportViolation("screen_split")
      }
    }

    // ── Interaction tracking ───────────────────────────────────────────────
    const onInteract = () => { lastInteractionRef.current = Date.now() }

    const INTERACTION_EVENTS = [
      "touchstart", "touchmove", "touchend",
      "pointerdown", "mousedown", "keydown", "scroll",
    ] as const

    INTERACTION_EVENTS.forEach(ev =>
      window.addEventListener(ev, onInteract, { passive: true, capture: true })
    )

    // ── Periodic checker ───────────────────────────────────────────────────
    const intervalId = setInterval(() => {
      if (!currentlyGuarded() || isLockedRef.current) return
      if (typeof document === "undefined") return

      const idle = Date.now() - lastInteractionRef.current

      if (document.visibilityState === "hidden") {
        if (idle >= AUTO_LOCK_IDLE_MS) { isLockedRef.current = true; return }
        if (!switchTimerRef.current)   { reportViolation("tab_switch") }
        return
      }

      // Flush any violation that couldn't be sent while offline
      flushPendingViolation()
      checkSplitScreen()
    }, 1500)

    // ── Resize ─────────────────────────────────────────────────────────────
    const onResize = () => checkSplitScreen()

    // ── Blur ───────────────────────────────────────────────────────────────
    const onBlur = () => {
      if (!currentlyGuarded()) return
      const idle = Date.now() - lastInteractionRef.current

      if (idle >= AUTO_LOCK_IDLE_MS || isLockedRef.current) {
        isLockedRef.current = true; return
      }

      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)

      blurTimerRef.current = setTimeout(() => {
        blurTimerRef.current = null
        if (!currentlyGuarded() || isLockedRef.current) return
        const nowIdle = Date.now() - lastInteractionRef.current
        if (nowIdle >= AUTO_LOCK_IDLE_MS) { isLockedRef.current = true; return }
        if (typeof document === "undefined") return
        if (!document.hasFocus() || document.visibilityState === "hidden") {
          reportViolation(document.visibilityState === "hidden" ? "tab_switch" : "window_blur")
        }
      }, SWITCH_GRACE_MS)
    }

    // ── Focus ──────────────────────────────────────────────────────────────
    const onFocus = () => {
      if (blurTimerRef.current)   { clearTimeout(blurTimerRef.current);   blurTimerRef.current   = null }
      if (switchTimerRef.current) { clearTimeout(switchTimerRef.current); switchTimerRef.current = null }

      isLockedRef.current        = false
      lastInteractionRef.current = Date.now()
      wakeGraceUntilRef.current  = Date.now() + 2500
      acquireWakeLock()

      // Flush pending violation now that socket should be reconnected
      setTimeout(flushPendingViolation, 1000)
    }

    // ── Visibility change ──────────────────────────────────────────────────
    const onVisibilityChange = () => {
      if (typeof document === "undefined") return

      if (document.visibilityState === "visible") {
        if (blurTimerRef.current)   { clearTimeout(blurTimerRef.current);   blurTimerRef.current   = null }
        if (switchTimerRef.current) { clearTimeout(switchTimerRef.current); switchTimerRef.current = null }

        isLockedRef.current        = false
        lastInteractionRef.current = Date.now()
        wakeGraceUntilRef.current  = Date.now() + 2500
        acquireWakeLock()

        // Give the socket ~1.5s to reconnect, then flush any stored violation
        setTimeout(flushPendingViolation, 1500)
        return
      }

      if (!currentlyGuarded()) return

      if (document.visibilityState === "hidden") {
        const idle = Date.now() - lastInteractionRef.current

        // Auto-lock: user was idle → screen timed out by itself
        if (idle >= AUTO_LOCK_IDLE_MS) {
          isLockedRef.current = true
          if (switchTimerRef.current) { clearTimeout(switchTimerRef.current); switchTimerRef.current = null }
          return
        }

        // Active switch: schedule violation after grace period
        if (!switchTimerRef.current) {
          switchTimerRef.current = setTimeout(() => {
            switchTimerRef.current = null
            if (typeof document === "undefined") return
            if (document.visibilityState === "hidden" && !isLockedRef.current && currentlyGuarded()) {
              reportViolation("tab_switch")
            }
          }, SWITCH_GRACE_MS)
        }
      }
    }

    // ── Page hide (mobile app switching) ──────────────────────────────────
    const onPageHide = () => {
      if (!currentlyGuarded()) return
      const idle = Date.now() - lastInteractionRef.current
      if (idle >= AUTO_LOCK_IDLE_MS || isLockedRef.current) { isLockedRef.current = true; return }

      if (!switchTimerRef.current) {
        switchTimerRef.current = setTimeout(() => {
          switchTimerRef.current = null
          if (!isLockedRef.current && currentlyGuarded()) {
            reportViolation("tab_switch")
          }
        }, SWITCH_GRACE_MS)
      }
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
      if (switchTimerRef.current) { clearTimeout(switchTimerRef.current); switchTimerRef.current = null }
      if (blurTimerRef.current)   { clearTimeout(blurTimerRef.current);   blurTimerRef.current   = null }
      INTERACTION_EVENTS.forEach(ev =>
        window.removeEventListener(ev, onInteract, { capture: true })
      )
      window.removeEventListener("resize",             onResize)
      window.removeEventListener("blur",               onBlur)
      window.removeEventListener("focus",              onFocus)
      window.removeEventListener("pagehide",           onPageHide)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      socket.off("connect", onSocketConnect)
      releaseWakeLock()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameId, socket])
}
