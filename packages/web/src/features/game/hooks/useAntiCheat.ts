import { EVENTS } from "@razzia/common/constants"
import { STATUS, type Status } from "@razzia/common/types/game/status"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { useEffect, useRef } from "react"

interface AntiCheatOptions {
  enabled: boolean
  gameId: string | null
  statusName: Status | undefined
}

// 1. Width ratio: If the browser window takes less than 70% of available screen width,
//    the user has tiled or snapped the window side-by-side with another app or browser.
const SPLIT_SCREEN_WIDTH_RATIO = 0.7

// 2. Height ratio: On mobile devices (and vertically tiled desktop windows),
//    split-screen divides the screen top-and-bottom.
//    Normal mobile browsing uses >= 78% of availHeight.
//    In vertical split-screen, innerHeight / availHeight drops below 65%.
const SPLIT_SCREEN_HEIGHT_RATIO = 0.65

export const useAntiCheat = ({
  enabled,
  gameId,
  statusName,
}: AntiCheatOptions) => {
  const { socket } = useSocket()
  const reportedRef = useRef(false)
  const mountTimeRef = useRef(Date.now())

  // Guard all active quiz states where participants answer questions or view rounds
  // Exclude only the initial room/lobby before start, and the end screens
  const isGuardedState = Boolean(
    statusName &&
      statusName !== STATUS.SHOW_ROOM &&
      statusName !== STATUS.FINISHED &&
      statusName !== STATUS.SUMMARY,
  )

  useEffect(() => {
    mountTimeRef.current = Date.now()
  }, [statusName])

  useEffect(() => {
    if (!enabled || !gameId || !isGuardedState || reportedRef.current) {
      return
    }

    const reportViolation = (reason: string) => {
      if (reportedRef.current) return
      // Never report if browser is offline or socket is disconnected (network disruption)
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      if (!socket.connected) return

      // Grace period of 1000ms after entering a question/quiz state to allow layout/focus settle
      if (Date.now() - mountTimeRef.current < 1000) return

      reportedRef.current = true
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

    // Schedule check after grace period (1200ms) to immediately catch pre-existing split screens
    const graceTimer = setTimeout(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        reportViolation("tab_switch")
        return
      }
      checkSplitScreen()
    }, 1200)

    // Periodic check every 1500ms in case window resize events are suppressed by OS/browser
    const intervalTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        reportViolation("tab_switch")
        return
      }
      checkSplitScreen()
    }, 1500)

    // Monitor window resize (e.g. user snapping or dragging window to split screen)
    const handleResize = () => {
      checkSplitScreen()
    }

    // Monitor focus loss (e.g. user clicking outside the browser window or interacting with another window)
    const handleBlur = () => {
      setTimeout(() => {
        if (typeof document !== "undefined") {
          if (!document.hasFocus() || document.visibilityState === "hidden") {
            reportViolation(
              document.visibilityState === "hidden" ? "tab_switch" : "window_blur",
            )
          }
        }
      }, 150)
    }

    // Monitor tab switching / app backgrounding
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        reportViolation("tab_switch")
      }
    }

    // Monitor mobile app switching / page hide
    const handlePageHide = () => {
      reportViolation("tab_switch")
    }

    window.addEventListener("resize", handleResize)
    window.addEventListener("blur", handleBlur)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      clearTimeout(graceTimer)
      clearInterval(intervalTimer)
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("blur", handleBlur)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [enabled, gameId, isGuardedState, socket])
}
