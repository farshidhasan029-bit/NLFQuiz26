import { useEffect, useRef } from "react"

/**
 * Keeps the screen awake (prevents device auto-lock) while the component
 * is mounted and the tab is visible.  Automatically re-acquires the wake
 * lock when the page becomes visible again (browsers release it on hide).
 */
export const useWakeLock = () => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return

    const acquire = async () => {
      if (wakeLockRef.current) return
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
        wakeLockRef.current!.addEventListener("release", () => {
          wakeLockRef.current = null
        })
      } catch {
        // Battery saver mode or permission denied — silently ignore
      }
    }

    const release = async () => {
      if (!wakeLockRef.current) return
      try { await wakeLockRef.current.release() } catch { /* ignore */ }
      wakeLockRef.current = null
    }

    // Re-acquire when the tab becomes visible (browsers auto-release on hide)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        acquire()
      }
    }

    acquire()
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      release()
    }
  }, [])
}
