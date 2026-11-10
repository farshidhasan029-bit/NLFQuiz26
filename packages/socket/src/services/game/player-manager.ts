import { EVENTS } from "@razzia/common/constants"
import type { GameSettings, Player, QuizzMode } from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import { usernameValidator } from "@razzia/common/validators/auth"
import { getClientId } from "@razzia/socket/utils/socket"

export interface PlayerManagerOptions {
  io: Server
  gameId: string
  gameMode: QuizzMode
  getManagerId: () => string
  isStarted: () => boolean
  getSettings?: () => GameSettings
}

export class PlayerManager {
  private readonly io: Server
  private readonly gameId: string
  private readonly gameMode: QuizzMode
  private readonly getManagerId: () => string
  private readonly isStarted: () => boolean
  private readonly getSettings?: () => GameSettings
  private players: Player[] = []
  private readonly deviceRegistry = new Map<
    string,
    { count: number; usernames: string[]; firstSeen: number }
  >()

  constructor({
    io,
    gameId,
    gameMode,
    getManagerId,
    isStarted,
    getSettings,
  }: PlayerManagerOptions) {
    this.io = io
    this.gameId = gameId
    this.gameMode = gameMode
    this.getManagerId = getManagerId
    this.isStarted = isStarted
    this.getSettings = getSettings
  }

  join(socket: Socket, username: string, deviceId?: string): string | null {
    const clientId = getClientId(socket)

    if (this.findByClientId(clientId)) {
      return "errors:game.playerAlreadyConnected"
    }

    const limit = this.getSettings?.().maxParticipants
    if (limit && limit > 0 && this.players.length >= limit) {
      return "errors:game.roomFull"
    }

    const result = usernameValidator.safeParse(username)

    if (result.error) {
      return result.error.issues[0].message
    }

    socket.join(this.gameId)

    let deviceJoinCount = 1
    if (deviceId) {
      const record = this.deviceRegistry.get(deviceId)
      if (record) {
        record.count += 1
        if (!record.usernames.includes(username)) {
          record.usernames.push(username)
        }
        deviceJoinCount = record.count
      } else {
        this.deviceRegistry.set(deviceId, {
          count: 1,
          usernames: [username],
          firstSeen: Date.now(),
        })
        deviceJoinCount = 1
      }
    }

    const player: Player = {
      id: socket.id,
      clientId,
      connected: true,
      username,
      points: 0,
      streak: 0,
      deviceId,
      deviceJoinCount,
    }

    this.players.push(player)
    this.io.to(this.getManagerId()).emit(EVENTS.MANAGER.NEW_PLAYER, player)
    this.broadcastCount()
    socket.emit(EVENTS.GAME.SUCCESS_JOIN, {
      gameId: this.gameId,
      username,
      gameMode: this.gameMode,
      detectScreenSplit: this.getSettings?.().detectScreenSplit ?? true,
      hidePlayerResults: this.getSettings?.().hidePlayerResults ?? true,
    })

    return null
  }

  kick(playerId: string, reason = "errors:game.kickedByManager"): boolean {
    const player = this.findById(playerId)

    if (!player) {
      return false
    }

    this.players = this.players.filter((p) => p.id !== playerId)

    this.io.in(playerId).socketsLeave(this.gameId)
    this.io.to(player.id).emit(EVENTS.GAME.RESET, reason)
    this.io
      .to(this.getManagerId())
      .emit(EVENTS.MANAGER.PLAYER_KICKED, player.id)
    this.broadcastCount()

    return true
  }

  remove(socketId: string): Player | undefined {
    const player = this.findById(socketId)

    if (!player) {
      return undefined
    }

    this.players = this.players.filter((p) => p.id !== socketId)

    return player
  }

  setDisconnected(socketId: string): void {
    const player = this.findById(socketId)

    if (player) {
      player.connected = false
    }
  }

  updateSocketId(oldId: string, newId: string): void {
    const player = this.findById(oldId)

    if (player) {
      player.id = newId
    }
  }

  replace(players: Player[]): void {
    this.players = players
  }

  findById(socketId: string): Player | undefined {
    return this.players.find((p) => p.id === socketId)
  }

  findByClientId(clientId: string): Player | undefined {
    return this.players.find((p) => p.clientId === clientId)
  }

  getAll(): Player[] {
    return this.players
  }

  count(): number {
    return this.players.length
  }

  joinedCount(): number {
    if (this.isStarted()) {
      return this.players.length
    }

    return this.players.filter((p) => p.connected).length
  }

  broadcastCount(): void {
    this.io.to(this.gameId).emit(EVENTS.GAME.TOTAL_PLAYERS, this.joinedCount())
  }
}
