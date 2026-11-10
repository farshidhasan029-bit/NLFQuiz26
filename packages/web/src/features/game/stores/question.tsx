import type { GameUpdateQuestion } from "@razzia/common/types/game"
import { create } from "zustand"

interface QuestionStore {
  questionStates: GameUpdateQuestion | null
  setQuestionStates: (_state: GameUpdateQuestion | null) => void
  isPaused: boolean
  pauseReason: string | null
  pauseUsername: string | null
  setPaused: (
    _paused: boolean,
    _reason?: string | null,
    _username?: string | null,
  ) => void
}

export const useQuestionStore = create<QuestionStore>((set) => ({
  questionStates: null,
  setQuestionStates: (state) => set({ questionStates: state }),
  isPaused: false,
  pauseReason: null,
  pauseUsername: null,
  setPaused: (isPaused, pauseReason = null, pauseUsername = null) =>
    set({ isPaused, pauseReason, pauseUsername }),
}))
