const DEVICE_ID_KEY = "nlf_device_id"
const DEVICE_JOINS_KEY = "nlf_device_joins"

export const getDeviceId = (): string => {
  if (typeof window === "undefined" || !window.localStorage) {
    return "dev_unknown"
  }

  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`
    try {
      localStorage.setItem(DEVICE_ID_KEY, id)
    } catch {
      // Ignore quota errors
    }
  }

  return id
}

export const getDeviceJoinCount = (): number => {
  if (typeof window === "undefined" || !window.localStorage) {
    return 1
  }

  const raw = localStorage.getItem(DEVICE_JOINS_KEY)
  const val = raw ? parseInt(raw, 10) : 0
  return Number.isNaN(val) ? 0 : val
}

export const recordDeviceJoin = (): number => {
  if (typeof window === "undefined" || !window.localStorage) {
    return 1
  }

  const current = getDeviceJoinCount()
  const next = current + 1
  try {
    localStorage.setItem(DEVICE_JOINS_KEY, String(next))
  } catch {
    // Ignore quota errors
  }

  return next
}
