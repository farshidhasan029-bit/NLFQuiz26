import { EVENTS, NO_TIME_LIMIT } from "@razzia/common/constants"
import type { Server } from "@razzia/common/types/game/socket"
import { SECOND_MS } from "@razzia/socket/utils/sleep"

export class CooldownTimer {
  private readonly io: Server
  private readonly gameId: string
  private active = false
  private paused = false

  constructor(io: Server, gameId: string) {
    this.io = io
    this.gameId = gameId
  }

  isPaused(): boolean {
    return this.paused
  }

  pause(): void {
    if (this.active) {
      this.paused = true
    }
  }

  resume(): void {
    if (this.active) {
      this.paused = false
    }
  }

  start(seconds: number): Promise<void> {
    if (this.active) {
      return Promise.resolve()
    }

    this.active = true
    this.paused = false

    if (seconds === NO_TIME_LIMIT) {
      return new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (!this.active) {
            clearInterval(interval)
            resolve()
          }
        }, SECOND_MS)
      })
    }

    let count = seconds - 1

    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!this.active || count <= 0) {
          this.active = false
          this.paused = false
          clearInterval(interval)
          resolve()

          return
        }

        if (this.paused) {
          return
        }

        this.io.to(this.gameId).emit(EVENTS.GAME.COOLDOWN, count)
        count -= 1
      }, SECOND_MS)
    })
  }

  abort() {
    this.active = false
    this.paused = false
  }
}
