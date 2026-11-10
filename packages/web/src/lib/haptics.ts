/**
 * Safely triggers vibration / haptic feedback on supported mobile devices.
 */
export const triggerHaptic = (pattern: number | number[] = 40): void => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      // Haptics not supported or blocked
    }
  }
}

export const HAPTIC_PATTERNS = {
  TAP: 40,
  LOCK: [50, 30, 50],
  SUCCESS: [60, 40, 60],
  ERROR: [40, 60, 40],
} as const
