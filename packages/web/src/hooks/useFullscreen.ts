import { useCallback, useEffect, useState } from "react"

export const isElementFullscreen = (): boolean => {
  if (typeof document === "undefined") return false
  const doc = document as any
  return Boolean(
    doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement,
  )
}

export const requestFullscreen = async () => {
  if (typeof document === "undefined") return
  const docEl = document.documentElement as any
  try {
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen()
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen()
    } else if (docEl.mozRequestFullScreen) {
      await docEl.mozRequestFullScreen()
    } else if (docEl.msRequestFullscreen) {
      await docEl.msRequestFullscreen()
    }
  } catch {
    // Ignore if not allowed or rejected
  }
}

export const exitFullscreen = async () => {
  if (typeof document === "undefined") return
  const doc = document as any
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen()
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen()
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen()
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen()
    }
  } catch {
    // Ignore
  }
}

export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(isElementFullscreen)

  useEffect(() => {
    const listener = () => setIsFullscreen(isElementFullscreen())

    document.addEventListener("fullscreenchange", listener)
    document.addEventListener("webkitfullscreenchange", listener)
    document.addEventListener("mozfullscreenchange", listener)
    document.addEventListener("MSFullscreenChange", listener)

    return () => {
      document.removeEventListener("fullscreenchange", listener)
      document.removeEventListener("webkitfullscreenchange", listener)
      document.removeEventListener("mozfullscreenchange", listener)
      document.removeEventListener("MSFullscreenChange", listener)
    }
  }, [])

  const toggle = useCallback(() => {
    if (isElementFullscreen()) {
      exitFullscreen()
    } else {
      requestFullscreen()
    }
  }, [])

  return {
    isFullscreen,
    toggle,
    enterFullscreen: requestFullscreen,
    exitFullscreen,
  }
}
