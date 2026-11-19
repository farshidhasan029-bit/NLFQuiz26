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

export const useAntiCheat = ({
  enabled,
  gameId,
  statusName,
  mode = "kick",
}: AntiCheatOptions) => {
  const { socket } = useSocket()
  const reportedRef = useRef(false)
  const lastViolationReportedAtRef = useRef(0)
  const mountTimeRef = useRef(Date.now())
  const lastInteractionRef = useRef(Date.now())
  const isScreenLockedRef = useRef(false)
  const wakeGraceUntilRef = useRef(0)
  const pendingSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<any>(null)

  const isSubmitted =
    typeof localStorage !== "undefined" && gameId
      ? localStorage.getItem(`quiz_submitted_${gameId}`) === "true"
      : false

  // Guard all active quiz states where participants answer questions or view rounds
  // Exclude initial room/lobby, end screens, waiting screens, and submitted state
  const isGuardedState = Boolean(
    !isSubmitted &&
      statusName &&
      statusName !== STATUS.SHOW_ROOM &&
      statusName !== STATUS.FINISHED &&
      statusName !== STATUS.SUMMARY &&
      statusName !== STATUS.WAIT,
  )

  useEffect(() => {
    mountTimeRef.current = Date.now()
    lastInteractionRef.current = Date.now()
    isScreenLockedRef.current = false
  }, [statusName])

  useEffect(() => {
    if (!enabled || !gameId || !isGuardedState) {
      return
    }
    if (mode === "kick" && reportedRef.current) {
      return
    }

    // 1. Screen Wake Lock: Keep screen awake so it doesn't wait and lock automatically while reading
    const acquireWakeLock = async () => {
      if (
        typeof navigator === "undefined" ||
        !("wakeLock" in navigator) ||
        wakeLockRef.current
      ) {
        return
      }
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null
        })
      } catch {
        // Ignored if rejected (e.g. system battery saver mode)
      }
    }

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release()
        } catch {
          // Ignore
        }
        wakeLockRef.current = null
      }
    }

    acquireWakeLock()

    const reportViolation = (reason: string) => {
      if (mode === "penalty") {
        if (Date.now() - lastViolationReportedAtRef.current < 6000) return
      } else {
        if (reportedRef.current) return
      }

      // Never report if browser is offline or socket is disconnected (network disruption)
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      if (!socket.connected) return

      // Grace period of 1500ms after entering a question/quiz state to allow layout/focus settle
      if (Date.now() - mountTimeRef.current < 1500) return
      // Grace period after waking up / unlocking screen
      if (Date.now() < wakeGraceUntilRef.current) return
      // Never report if the device screen waited and locked automatically
      if (isScreenLockedRef.current) return

      if (mode === "penalty") {
        lastViolationReportedAtRef.current = Date.now()
      } else {
        reportedRef.current = true
      }

      socket.emit(EVENTS.PLAYER.CHEATING_DETECTED, {
        gameId,
        reason,
      })
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
      if (typeof window === "undefined") return
      // Skip if screen is locked or within wake-up grace period
      if (isScreenLockedRef.current || Date.now() < wakeGraceUntilRef.current) {
        return
      }

      const screenWidth = window.screen.availWidth || window.screen.width
      const screenHeight = window.screen.availHeight || window.screen.height
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      // 1. Horizontal Split: Browser width is less than 70% of available screen width
      // (Applies to desktop, tablets, and landscape phones)
      if (screenWidth > 0) {
        const widthRatio = windowWidth / screenWidth
        if (widthRatio < SPLIT_SCREEN_WIDTH_RATIO) {
          reportViolation("screen_split")
          return
        }
      }

      // 2. Vertical Split: On mobile portrait or vertical multi-window,
      // window height is less than 65% of screen height.
      // We ignore this if user is currently typing in an input (virtual keyboard).
      if (screenHeight > 0 && !isTypingInInput()) {
        const heightRatio = windowHeight / screenHeight
        if (heightRatio < SPLIT_SCREEN_HEIGHT_RATIO) {
          reportViolation("screen_split")
          return
        }
      }
    }

    // Track user touch, click, scroll, and key interaction timestamps
    const registerInteraction = () => {
      lastInteractionRef.current = Date.now()
    }

    const interactionEvents = [
      "touchstart",
      "touchmove",
      "touchend",
      "pointerdown",
      "mousedown",
      "keydown",
      "scroll",
    ] as const

    interactionEvents.forEach((ev) => {
      window.addEventListener(ev, registerInteraction, {
        passive: true,
        capture: true,
      })
    })

    // Schedule initial check after grace period (1500ms) to catch pre-existing split screens
    const graceTimer = setTimeout(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden" &&
        !isScreenLockedRef.current
      ) {
        const idleTime = Date.now() - lastInteractionRef.current
        if (idleTime < AUTO_LOCK_IDLE_THRESHOLD_MS) {
          reportViolation("tab_switch")
          return
        }
      }
      checkSplitScreen()
    }, 1500)

    // Periodic check every 1500ms for split-screen changes
    const intervalTimer = setInterval(() => {
      if (typeof document !== "undefined") {
        if (isScreenLockedRef.current) {
          return
        }

        // Detect if screen timed out and locked without explicit visibility event
        const idleTime = Date.now() - lastInteractionRef.current
        if (
          document.visibilityState === "hidden" &&
          idleTime >= AUTO_LOCK_IDLE_THRESHOLD_MS
        ) {
          isScreenLockedRef.current = true
          return
        }

        if (document.visibilityState === "hidden") {
          // If not an auto-lock, check if pending timer is already queued
          if (!pendingSwitchTimerRef.current) {
            reportViolation("tab_switch")
          }
          return
        }
      }

      checkSplitScreen()
    }, 1500)

    // Monitor window resize (e.g. user snapping or dragging window to split screen)
    const handleResize = () => {
      checkSplitScreen()
    }

    // Monitor focus loss (e.g. user clicking outside or screen locking)
    const handleBlur = () => {
      const idleTime = Date.now() - lastInteractionRef.current

      // If the user was idle before blur, the screen waited and locked automatically!
      if (idleTime >= AUTO_LOCK_IDLE_THRESHOLD_MS || isScreenLockedRef.current) {
        isScreenLockedRef.current = true
        return
      }

      if (pendingBlurTimerRef.current) {
        clearTimeout(pendingBlurTimerRef.current)
      }

      // Allow a grace period for transient overlays or quick interactions
      pendingBlurTimerRef.current = setTimeout(() => {
        pendingBlurTimerRef.current = null
        if (typeof document === "undefined") return
        if (isScreenLockedRef.current) return

        const currentIdle = Date.now() - lastInteractionRef.current
        if (currentIdle >= AUTO_LOCK_IDLE_THRESHOLD_MS) {
          isScreenLockedRef.current = true
          return
        }

        if (!document.hasFocus() || document.visibilityState === "hidden") {
          reportViolation(
            document.visibilityState === "hidden" ? "tab_switch" : "window_blur",
          )
        }
      }, ACTIVE_SWITCH_GRACE_MS)
    }

    // Monitor focus gain (screen unlock, user returns to quiz)
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

    // Monitor tab switching / app backgrounding vs automatic screen lock
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return

      if (document.visibilityState === "visible") {
        // Screen unlocked or participant returned to quiz
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

      if (document.visibilityState === "hidden") {
        const idleTime = Date.now() - lastInteractionRef.current

        // Automatic screen lock / sleep check:
        // If the user did not touch the screen for >= AUTO_LOCK_IDLE_THRESHOLD_MS,
        // the display simply waited and locked automatically. Never expel them!
        if (idleTime >= AUTO_LOCK_IDLE_THRESHOLD_MS) {
          isScreenLockedRef.current = true
          if (pendingSwitchTimerRef.current) {
            clearTimeout(pendingSwitchTimerRef.current)
            pendingSwitchTimerRef.current = null
          }
          return
        }

        // If the user actively touched right before leaving, provide a grace period
        // before counting as an intentional app/tab switch.
        if (!pendingSwitchTimerRef.current) {
          pendingSwitchTimerRef.current = setTimeout(() => {
            pendingSwitchTimerRef.current = null
            if (
              typeof document !== "undefined" &&
              document.visibilityState === "hidden" &&
              !isScreenLockedRef.current
            ) {
              reportViolation("tab_switch")
            }
          }, ACTIVE_SWITCH_GRACE_MS)
        }
      }
    }

    // Monitor mobile app switching / page hide
    const handlePageHide = () => {
      const idleTime = Date.now() - lastInteractionRef.current
      if (idleTime >= AUTO_LOCK_IDLE_THRESHOLD_MS || isScreenLockedRef.current) {
        isScreenLockedRef.current = true
        return
      }

      if (!pendingSwitchTimerRef.current) {
        pendingSwitchTimerRef.current = setTimeout(() => {
          pendingSwitchTimerRef.current = null
          if (!isScreenLockedRef.current) {
            reportViolation("tab_switch")
          }
        }, ACTIVE_SWITCH_GRACE_MS)
      }
    }

    window.addEventListener("resize", handleResize)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      clearTimeout(graceTimer)
      clearInterval(intervalTimer)
      if (pendingSwitchTimerRef.current) {
        clearTimeout(pendingSwitchTimerRef.current)
        pendingSwitchTimerRef.current = null
      }
      if (pendingBlurTimerRef.current) {
        clearTimeout(pendingBlurTimerRef.current)
        pendingBlurTimerRef.current = null
      }
      interactionEvents.forEach((ev) => {
        window.removeEventListener(ev, registerInteraction, {
          capture: true,
        })
      })
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
      releaseWakeLock()
    }
  }, [enabled, gameId, isGuardedState, mode, socket])
}
