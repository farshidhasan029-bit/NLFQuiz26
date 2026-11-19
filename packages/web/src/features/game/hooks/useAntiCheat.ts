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

// 1. Width ratio: If the browser window takes less than 70% of available screen width,
//    the user has tiled or snapped the window side-by-side with another app or browser.
const SPLIT_SCREEN_WIDTH_RATIO = 0.7

// 2. Height ratio: On mobile devices (and vertically tiled desktop windows),
//    split-screen divides the screen top-and-bottom.
//    Normal mobile browsing uses >= 78% of availHeight.
//    In vertical split-screen, innerHeight / availHeight drops below 65%.
const SPLIT_SCREEN_HEIGHT_RATIO = 0.65

// 3. Auto-lock idle threshold:
//    When a phone/device screen "waits and locks automatically", the user has stopped
//    interacting with the screen for at least the display timeout (15s, 30s, 60s+).
//    If the user has been idle for >= 3000ms when visibilitychange/blur/pagehide occurs,
//    it is an automatic screen timeout / lock, NOT an intentional swipe to another app.
const AUTO_LOCK_IDLE_THRESHOLD_MS = 3000

// 4. Grace period for active app/tab switch before expulsion:
//    Allows momentary interruptions (e.g. system notification banners, brief lock/unlock,
//    incoming call prompt) without instantly and irreversibly expelling the user.
const ACTIVE_SWITCH_GRACE_MS = 3000

// States where anti-cheat is NOT active (pre-game, post-game, between-round waiting)
const UNGUARDED_STATUSES: Set<Status> = new Set([
  STATUS.SHOW_ROOM,
  STATUS.SHOW_START,
  STATUS.SHOW_PREPARED,
  STATUS.FINISHED,
  STATUS.SUMMARY,
  STATUS.WAIT,
])

function isGuarded(statusName: Status | undefined, gameId: string | null): boolean {
  if (!statusName) return false
  if (UNGUARDED_STATUSES.has(statusName)) return false
  // Don't guard if player has already submitted
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

  // Persistent refs — survive status transitions so we don't lose context
  const reportedRef = useRef(false)
  const lastViolationReportedAtRef = useRef(0)
  const guardedSinceRef = useRef<number | null>(null)   // when we first entered a guarded state
  const lastInteractionRef = useRef(Date.now())
  const isScreenLockedRef = useRef(false)
  const wakeGraceUntilRef = useRef(0)
  const pendingSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<any>(null)

  // Keep latest values in refs so event callbacks always see current values
  // without needing to be re-registered (avoids listener thrash on status change)
  const enabledRef = useRef(enabled)
  const gameIdRef = useRef(gameId)
  const statusNameRef = useRef(statusName)
  const modeRef = useRef(mode)

  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { gameIdRef.current = gameId }, [gameId])
  useEffect(() => { modeRef.current = mode }, [mode])

  // Track when we enter/leave guarded states — update guardedSinceRef
  useEffect(() => {
    const guarded = isGuarded(statusName, gameId)
    statusNameRef.current = statusName

    if (guarded && guardedSinceRef.current === null) {
      // Just entered a guarded state for the first time (or after a gap)
      guardedSinceRef.current = Date.now()
      lastInteractionRef.current = Date.now()
      isScreenLockedRef.current = false
    } else if (!guarded) {
      // Exited guarded state — clear the timer so we don't falsely fire
      guardedSinceRef.current = null
      if (pendingSwitchTimerRef.current) {
        clearTimeout(pendingSwitchTimerRef.current)
        pendingSwitchTimerRef.current = null
      }
      if (pendingBlurTimerRef.current) {
        clearTimeout(pendingBlurTimerRef.current)
        pendingBlurTimerRef.current = null
      }
    }
  }, [statusName, gameId])

  // Main effect — register listeners ONCE per mount (not per status change)
  useEffect(() => {
    if (!enabled || !gameId) return

    // ── Wake Lock ─────────────────────────────────────────────────────────────
    const acquireWakeLock = async () => {
      if (
        typeof navigator === "undefined" ||
        !("wakeLock" in navigator) ||
        wakeLockRef.current
      ) return
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null
        })
      } catch {
        // Ignored if rejected (e.g. battery saver)
      }
    }

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try { await wakeLockRef.current.release() } catch { /* ignore */ }
        wakeLockRef.current = null
      }
    }

    acquireWakeLock()

    // ── Helpers ───────────────────────────────────────────────────────────────
    const currentlyGuarded = () =>
      enabledRef.current && isGuarded(statusNameRef.current, gameIdRef.current)

    const reportViolation = (reason: string) => {
      if (!currentlyGuarded()) return

      const mode = modeRef.current
      if (mode === "penalty") {
        if (Date.now() - lastViolationReportedAtRef.current < 6000) return
      } else {
        if (reportedRef.current) return
      }

      // Never report if offline or socket disconnected
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      if (!socket.connected) return

      // Grace period after first entering a guarded state
      const guardedSince = guardedSinceRef.current
      if (guardedSince === null || Date.now() - guardedSince < 1500) return

      // Grace period after waking up / unlocking screen
      if (Date.now() < wakeGraceUntilRef.current) return

      // Never report if device screen auto-locked
      if (isScreenLockedRef.current) return

      if (mode === "penalty") {
        lastViolationReportedAtRef.current = Date.now()
      } else {
        reportedRef.current = true
      }

      socket.emit(EVENTS.PLAYER.CHEATING_DETECTED, { gameId: gameIdRef.current, reason })
    }

    const isTypingInInput = () => {
      if (typeof document === "undefined") return false
      const active = document.activeElement
      if (!active) return false
      const tag = active.tagName.toLowerCase()
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (active as HTMLElement).isContentEditable
      )
    }

    const checkSplitScreen = () => {
      if (!currentlyGuarded()) return
      if (isScreenLockedRef.current || Date.now() < wakeGraceUntilRef.current) return

      const screenWidth = window.screen.availWidth || window.screen.width
      const screenHeight = window.screen.availHeight || window.screen.height
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      if (screenWidth > 0) {
        const widthRatio = windowWidth / screenWidth
        if (widthRatio < SPLIT_SCREEN_WIDTH_RATIO) {
          reportViolation("screen_split")
          return
        }
      }

      if (screenHeight > 0 && !isTypingInInput()) {
        const heightRatio = windowHeight / screenHeight
        if (heightRatio < SPLIT_SCREEN_HEIGHT_RATIO) {
          reportViolation("screen_split")
          return
        }
      }
    }

    // ── Interaction tracking ──────────────────────────────────────────────────
    const registerInteraction = () => {
      lastInteractionRef.current = Date.now()
    }

    const interactionEvents = [
      "touchstart", "touchmove", "touchend",
      "pointerdown", "mousedown", "keydown", "scroll",
    ] as const

    interactionEvents.forEach((ev) =>
      window.addEventListener(ev, registerInteraction, { passive: true, capture: true })
    )

    // ── Periodic split-screen check ───────────────────────────────────────────
    const intervalTimer = setInterval(() => {
      if (!currentlyGuarded()) return
      if (isScreenLockedRef.current) return
      if (typeof document === "undefined") return

      const idleTime = Date.now() - lastInteractionRef.current

      if (document.visibilityState === "hidden") {
        // Idle long enough → auto-lock, not cheating
        if (idleTime >= AUTO_LOCK_IDLE_THRESHOLD_MS) {
          isScreenLockedRef.current = true
          return
        }
        // Not idle → still hidden after grace? → violation
        if (!pendingSwitchTimerRef.current) {
          reportViolation("tab_switch")
        }
        return
      }

      checkSplitScreen()
    }, 1500)

    // ── Resize ────────────────────────────────────────────────────────────────
    const handleResize = () => checkSplitScreen()

    // ── Blur ──────────────────────────────────────────────────────────────────
    const handleBlur = () => {
      if (!currentlyGuarded()) return
      const idleTime = Date.now() - lastInteractionRef.current

      if (idleTime >= AUTO_LOCK_IDLE_THRESHOLD_MS || isScreenLockedRef.current) {
        isScreenLockedRef.current = true
        return
      }

      if (pendingBlurTimerRef.current) clearTimeout(pendingBlurTimerRef.current)

      pendingBlurTimerRef.current = setTimeout(() => {
        pendingBlurTimerRef.current = null
        if (!currentlyGuarded()) return
        if (isScreenLockedRef.current) return

        const currentIdle = Date.now() - lastInteractionRef.current
        if (currentIdle >= AUTO_LOCK_IDLE_THRESHOLD_MS) {
          isScreenLockedRef.current = true
          return
        }

        if (typeof document === "undefined") return
        if (!document.hasFocus() || document.visibilityState === "hidden") {
          reportViolation(
            document.visibilityState === "hidden" ? "tab_switch" : "window_blur"
          )
        }
      }, ACTIVE_SWITCH_GRACE_MS)
    }

    // ── Focus ─────────────────────────────────────────────────────────────────
    const handleFocus = () => {
      if (pendingBlurTimerRef.current) {
        clearTimeout(pendingBlurTimerRef.current)
        pendingBlurTimerRef.current = null
      }
      if (pendingSwitchTimerRef.current) {
        clearTimeout(pendingSwitchTimerRef.current)
        pendingSwitchTimerRef.current = null
      }

      isScreenLockedRef.current = false
      lastInteractionRef.current = Date.now()
      wakeGraceUntilRef.current = Date.now() + 2500
      acquireWakeLock()
    }

    // ── Visibility change ─────────────────────────────────────────────────────
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return

      if (document.visibilityState === "visible") {
        if (pendingSwitchTimerRef.current) {
          clearTimeout(pendingSwitchTimerRef.current)
          pendingSwitchTimerRef.current = null
        }
        if (pendingBlurTimerRef.current) {
          clearTimeout(pendingBlurTimerRef.current)
          pendingBlurTimerRef.current = null
        }
        isScreenLockedRef.current = false
        lastInteractionRef.current = Date.now()
        wakeGraceUntilRef.current = Date.now() + 2500
        acquireWakeLock()
        return
      }

      if (!currentlyGuarded()) return

      if (document.visibilityState === "hidden") {
        const idleTime = Date.now() - lastInteractionRef.current

        if (idleTime >= AUTO_LOCK_IDLE_THRESHOLD_MS) {
          isScreenLockedRef.current = true
          if (pendingSwitchTimerRef.current) {
            clearTimeout(pendingSwitchTimerRef.current)
            pendingSwitchTimerRef.current = null
          }
          return
        }

        if (!pendingSwitchTimerRef.current) {
          pendingSwitchTimerRef.current = setTimeout(() => {
            pendingSwitchTimerRef.current = null
            if (
              typeof document !== "undefined" &&
              document.visibilityState === "hidden" &&
              !isScreenLockedRef.current &&
              currentlyGuarded()
            ) {
              reportViolation("tab_switch")
            }
          }, ACTIVE_SWITCH_GRACE_MS)
        }
      }
    }

    // ── Page hide (mobile app switching) ──────────────────────────────────────
    const handlePageHide = () => {
      if (!currentlyGuarded()) return
      const idleTime = Date.now() - lastInteractionRef.current
      if (idleTime >= AUTO_LOCK_IDLE_THRESHOLD_MS || isScreenLockedRef.current) {
        isScreenLockedRef.current = true
        return
      }

      if (!pendingSwitchTimerRef.current) {
        pendingSwitchTimerRef.current = setTimeout(() => {
          pendingSwitchTimerRef.current = null
          if (!isScreenLockedRef.current && currentlyGuarded()) {
            reportViolation("tab_switch")
          }
        }, ACTIVE_SWITCH_GRACE_MS)
      }
    }

    // ── Register all listeners ────────────────────────────────────────────────
    window.addEventListener("resize", handleResize)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      clearInterval(intervalTimer)
      if (pendingSwitchTimerRef.current) {
        clearTimeout(pendingSwitchTimerRef.current)
        pendingSwitchTimerRef.current = null
      }
      if (pendingBlurTimerRef.current) {
        clearTimeout(pendingBlurTimerRef.current)
        pendingBlurTimerRef.current = null
      }
      interactionEvents.forEach((ev) =>
        window.removeEventListener(ev, registerInteraction, { capture: true })
      )
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
      releaseWakeLock()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameId, socket])
  // Note: statusName and mode are intentionally NOT in deps — they're read via refs
  // so listeners are registered only once and survive status transitions cleanly.
}
