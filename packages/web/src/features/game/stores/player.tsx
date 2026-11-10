import { QUIZZ_MODES } from "@razzia/common/constants"
import type { QuizzMode } from "@razzia/common/types/game"
import type { StatusDataMap } from "@razzia/common/types/game/status"
import type { Status } from "@razzia/web/features/game/utils/createStatus"
import { create } from "zustand"

interface PlayerInfo {
  username?: string
  points?: number
}

interface PlayerState<T> {
  gameId: string | null
  inviteCode: string | null
  gameMode: QuizzMode
  generatedUsernames: boolean
  detectScreenSplit: boolean
  hidePlayerResults: boolean
  joinTicket: string | null
  player: PlayerInfo | null
  status: Status<T> | null
}

type PlayerStore<T> = PlayerState<T> & {
  updatePlayer: (
    _state:
      | Partial<PlayerState<T>>
      | ((_state: PlayerState<T>) => Partial<PlayerState<T>>),
  ) => void
  resetPlayer: () => void
}

const PLAYER_STORAGE_KEY = "player_progress"

const readStoredPlayer = (): PlayerInfo | null => {
  try {
    if (typeof localStorage === "undefined") return null
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeStoredPlayer = (player: PlayerInfo | null | undefined) => {
  try {
    if (typeof localStorage === "undefined") return
    if (player) {
      localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player))
    } else {
      localStorage.removeItem(PLAYER_STORAGE_KEY)
    }
  } catch {
    /* empty */
  }
}

const initialState: PlayerState<StatusDataMap> = {
  gameId: typeof localStorage !== "undefined" ? localStorage.getItem("game_id") : null,
  inviteCode: typeof localStorage !== "undefined" ? localStorage.getItem("game_pin") : null,
  gameMode: QUIZZ_MODES.QUIZ,
  generatedUsernames: false,
  detectScreenSplit: true,
  hidePlayerResults: true,
  joinTicket: null,
  player: readStoredPlayer(),
  status: null,
}

export const usePlayerStore = create<PlayerStore<StatusDataMap>>((set) => ({
  ...initialState,

  updatePlayer: (state) =>
    set((current) => {
      const next = typeof state === "function" ? state(current) : state
      if (next.player !== undefined) {
        writeStoredPlayer(next.player)
      }
      return next
    }),

  resetPlayer: () => {
    writeStoredPlayer(null)
    set(initialState)
  },
}))
