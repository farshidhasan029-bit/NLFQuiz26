import { createDefaultGameSettings, EVENTS } from "@razzia/common/constants"
import type {
  GameSettings,
  Player,
  Quizz,
  QuizzMode,
  ResultQueryRequest,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import {
  STATUS,
  type Status,
  type StatusDataMap,
} from "@razzia/common/types/game/status"
import { saveResult } from "@razzia/socket/services/config"
import { CooldownTimer } from "@razzia/socket/services/game/cooldown-timer"
import { PlayerManager } from "@razzia/socket/services/game/player-manager"
import { RoundManager } from "@razzia/socket/services/game/round-manager"
import Registry from "@razzia/socket/services/registry"
import { createInviteCode } from "@razzia/socket/utils/game"
import { createNickname } from "@razzia/socket/utils/nickname"
import { SECOND_MS } from "@razzia/socket/utils/sleep"
import { getClientId } from "@razzia/socket/utils/socket"
import { v7 as uuid } from "uuid"

const registry = Registry.getInstance()

const MANAGER_GRACE_SECONDS = 30

class Game {
  readonly gameId: string
  readonly inviteCode: string
  readonly gameMode: QuizzMode

  private _settings: GameSettings = createDefaultGameSettings()
  private _locked = false

  private readonly io: Server
  private readonly _manager: {
    id: string
    clientId: string
    connected: boolean
  }
  private readonly playerManager: PlayerManager
  private readonly round: RoundManager
  private readonly cooldown: CooldownTimer
  private managerGraceTimer: NodeJS.Timeout | null = null

  private lastBroadcastStatus: {
    name: Status
    data: StatusDataMap[Status]
  } | null = null
  private managerStatus: {
    name: Status
    data: StatusDataMap[Status]
  } | null = null
  private playerStatus = new Map<
    string,
    { name: Status; data: StatusDataMap[Status] }
  >()
  private expelledClientIds = new Set<string>()
  private expelledDeviceIds = new Set<string>()
  private pendingResultRequests = new Map<string, ResultQueryRequest>()
  private approvedPlayerIds = new Set<string>()

  isExpelled(clientId: string, deviceId?: string): boolean {
    if (this.expelledClientIds.has(clientId)) {
      return true
    }
    if (deviceId && this.expelledDeviceIds.has(deviceId)) {
      return true
    }
    return false
  }

  constructor(io: Server, managerClientId: string, quizz: Quizz) {
    this.io = io
    this.gameId = uuid()
    this.inviteCode = createInviteCode()
    this.gameMode = quizz.gameMode
    this._manager = {
      id: "",
      clientId: managerClientId,
      connected: false,
    }

    this.cooldown = new CooldownTimer(io, this.gameId)

    this.playerManager = new PlayerManager({
      io,
      gameId: this.gameId,
      gameMode: quizz.gameMode,
      getManagerId: () => this._manager.id,
      isStarted: () => this.started,
      getSettings: () => this.settings,
    })

    this.round = new RoundManager({
      quizz,
      players: this.playerManager,
      cooldown: this.cooldown,
      io,
      gameId: this.gameId,
      getManagerId: () => this._manager.id,
      broadcast: this.broadcastStatus.bind(this),
      send: this.sendStatus.bind(this),
      onNewQuestion: () => {
        this.playerStatus.clear()
        this.managerStatus = null
      },
      onGameFinished: saveResult,
      getSettings: () => this._settings,
    })

    console.log(
      `New game created: ${this.inviteCode} subject: ${quizz.subject}`,
    )
  }

  get manager() {
    return this._manager
  }

  get players(): Player[] {
    return this.playerManager.getAll()
  }

  get started(): boolean {
    return this.round.isStarted()
  }

  get hasStarted(): boolean {
    return this.round.hasStarted()
  }

  get isFinished(): boolean {
    return this.round.isFinished()
  }

  isPlayerFinished(socketId: string): boolean {
    return this.round.isPlayerFinished(socketId)
  }

  get quizzSubject(): string {
    return this.round.getSubject()
  }

  get settings(): GameSettings {
    return this._settings
  }

  updateSettings(settings: Partial<GameSettings>): boolean {
    if (this.started) {
      return false
    }

    this._settings = { ...this._settings, ...settings }

    return true
  }

  get locked(): boolean {
    return this._locked
  }

  setLocked(locked: boolean) {
    this._locked = locked
    this.io.to(this._manager.id).emit(EVENTS.MANAGER.LOCK_UPDATED, locked)
  }

  pauseGame() {
    this.round.pauseGame()
  }

  resumeGame() {
    this.round.resumeGame()
  }

  get isPaused(): boolean {
    return this.round.isPaused
  }

  // ── Status broadcasting ──────────────────────────────────────────────────

  private broadcastStatus<T extends Status>(status: T, data: StatusDataMap[T]) {
    const statusData = { name: status, data }
    this.lastBroadcastStatus = statusData
    this.io.to(this.gameId).emit(EVENTS.GAME.STATUS, statusData)
  }

  private sendStatus<T extends Status>(
    target: string,
    status: T,
    data: StatusDataMap[T],
  ) {
    const statusData = { name: status, data }

    if (this._manager.id === target) {
      this.managerStatus = statusData
    } else {
      this.playerStatus.set(target, statusData)
    }

    this.io.to(target).emit(EVENTS.GAME.STATUS, statusData)
  }

  // Player actions

  join(socket: Socket, username?: string, deviceId?: string): string | null {
    const clientId = getClientId(socket)
    if (this.isExpelled(clientId, deviceId)) {
      return "errors:game.expelledForCheating"
    }

    // If this clientId is already a player in this game (re-join from same device),
    // treat it as a reconnect rather than a new join so the host sees them correctly.
    if (clientId && this.playerManager.findByClientId(clientId)) {
      this.reconnectPlayer(socket)
      return null
    }

    if (this._locked) {
      return "errors:game.locked"
    }

    const chosenUsername = this._settings.generatedUsernames
      ? createNickname(this.playerManager.getAll().map((player) => player.username))
      : username

    if (!chosenUsername) {
      return "errors:auth.usernameTooShort"
    }

    let extraJoinData:
      | {
          status?: { name: Status; data: any }
          currentQuestion?: any
        }
      | undefined = undefined

    if (this.started) {
      const activeStatus = this._settings.selfPaced
        ? {
            name: STATUS.SELF_PACED_QUIZ,
            data: this.round.getSelfPacedPayload(),
          }
        : this.lastBroadcastStatus

      extraJoinData = {
        status: activeStatus ?? undefined,
        currentQuestion: this.round.getReconnectInfo(),
      }
    }

    const error = this.playerManager.join(
      socket,
      chosenUsername,
      deviceId,
      extraJoinData,
    )
    if (error) {
      return error
    }

    if (this.started) {
      const player = this.playerManager.findById(socket.id)
      if (player) {
        this.round.registerPlayer(player)

        if (extraJoinData?.status) {
          this.playerStatus.set(socket.id, extraJoinData.status)
          socket.emit(EVENTS.GAME.STATUS, extraJoinData.status)
        }

        const reconnectInfo = this.round.getReconnectInfo()
        if (reconnectInfo) {
          socket.emit(EVENTS.GAME.UPDATE_QUESTION, {
            current: reconnectInfo.current,
            total: reconnectInfo.total,
          })
        }

        const timerState = this.round.getUltimateTimerState()
        if (timerState.active) {
          socket.emit(EVENTS.GAME.ULTIMATE_TIMER_UPDATE, timerState)
        }
      }
    }

    registry.reactivateGame(this.gameId)

    return null
  }

  private disconnectAutoResumeTimer: NodeJS.Timeout | null = null

  dispose() {
    if (this.disconnectAutoResumeTimer) {
      clearTimeout(this.disconnectAutoResumeTimer)
      this.disconnectAutoResumeTimer = null
    }
    this.round.clearAutoAdvance()
    this.round.clearUltimateTimer()
    this.cooldown.abort()
    this.cancelManagerGrace()
  }

  waitForManager(onTimeout: () => void) {
    this.cancelManagerGrace()
    this.managerGraceTimer = setTimeout(() => {
      this.managerGraceTimer = null

      if (!this._manager.connected && !this.started) {
        onTimeout()
      }
    }, MANAGER_GRACE_SECONDS * SECOND_MS)
  }

  private cancelManagerGrace() {
    if (this.managerGraceTimer) {
      clearTimeout(this.managerGraceTimer)
      this.managerGraceTimer = null
    }
  }

  kickPlayer(playerId: string) {
    if (this.playerManager.kick(playerId)) {
      this.playerStatus.delete(playerId)
    }
  }

  private playerLastPenaltyTime = new Map<string, number>()

  handleCheatingDetected(socket: Socket, reason?: string) {
    if (this.isPlayerFinished(socket.id)) {
      return
    }
    if (this._settings.antiCheatMode === "penalty") {
      this.penalizeCheater(socket, reason)
    } else {
      this.expelCheater(socket, reason)
    }
  }

  penalizeCheater(socket: Socket, reason?: string) {
    const clientId = getClientId(socket)
    const player =
      this.playerManager.findById(socket.id) ||
      (clientId ? this.playerManager.findByClientId(clientId) : undefined)
    if (!player) {
      return
    }

    const now = Date.now()
    const lastPenalty = this.playerLastPenaltyTime.get(player.id) ?? 0
    if (now - lastPenalty < 5000) {
      return
    }
    this.playerLastPenaltyTime.set(player.id, now)

    const penaltyPoints = this._settings.antiCheatPenaltyPoints || 500
    player.points = Math.max(0, player.points - penaltyPoints)

    this.round.recordCheatPenalty(player.id, penaltyPoints)

    const username = player.username
    const playerId = player.id

    // Notify player
    socket.emit(EVENTS.PLAYER.CHEATING_PENALTY, {
      penaltyPoints,
      currentPoints: player.points,
      reason: reason || "screen_split",
    })

    // Notify manager
    this.io.to(this._manager.id).emit(EVENTS.MANAGER.PLAYER_PENALIZED, {
      playerId,
      username,
      penaltyPoints,
      currentPoints: player.points,
      reason: reason || "screen_split",
    })

    // Update manager player list
    this.io.to(this._manager.id).emit(EVENTS.MANAGER.PLAYER_UPDATED, {
      id: playerId,
      points: player.points,
      username: player.username,
    })
  }

  expelCheater(socket: Socket, reason?: string) {
    const clientId = getClientId(socket)
    const player =
      this.playerManager.findById(socket.id) ||
      (clientId ? this.playerManager.findByClientId(clientId) : undefined)
    if (!player) {
      return
    }

    if (clientId) {
      this.expelledClientIds.add(clientId)
    }
    if (player.deviceId) {
      this.expelledDeviceIds.add(player.deviceId)
    }

    const username = player.username
    const playerId = player.id
    if (this.playerManager.kick(playerId, "errors:game.expelledForCheating")) {
      this.playerStatus.delete(playerId)
      this.playerStatus.delete(socket.id)
      this.io.to(this._manager.id).emit(EVENTS.MANAGER.PLAYER_EXPELLED, {
        playerId,
        username,
        reason: reason || "screen_split",
      })
      this.round.endIfEveryoneAnswered()
    }
  }

  // Reconnect

  reconnect(socket: Socket) {
    const clientId = getClientId(socket)

    if (this._manager.clientId === clientId) {
      this.reconnectManager(socket)

      return
    }

    if (this.isExpelled(clientId)) {
      socket.emit(EVENTS.GAME.RESET, "errors:game.expelledForCheating")
      return
    }

    this.reconnectPlayer(socket)
  }

  private reconnectManager(socket: Socket) {
    const previousSocketId = this._manager.connected ? this._manager.id : null

    socket.join(this.gameId)
    this._manager.id = socket.id
    this._manager.connected = true
    this.cancelManagerGrace()

    if (previousSocketId && previousSocketId !== socket.id) {
      this.io
        .to(previousSocketId)
        .emit(EVENTS.GAME.RESET, "errors:game.managerAlreadyConnected")
      this.io.in(previousSocketId).disconnectSockets(true)
    }

    const status = (() => {
      if (this.managerStatus) {
        return this.managerStatus
      }

      if (this.lastBroadcastStatus) {
        return this.lastBroadcastStatus
      }

      return {
        name: STATUS.SHOW_ROOM,
        data: {
          text: "game:waitingForPlayers",
          inviteCode: this.inviteCode,
        },
      }
    })()

    socket.emit(EVENTS.MANAGER.SUCCESS_RECONNECT, {
      gameId: this.gameId,
      inviteCode: this.inviteCode,
      settings: this._settings,
      locked: this._locked,
      currentQuestion: this.round.getReconnectInfo(),
      status,
      players: this.playerManager.getAll(),
    })
    socket.emit(EVENTS.GAME.TOTAL_PLAYERS, this.playerManager.joinedCount())

    registry.reactivateGame(this.gameId)
    if (this._settings.selfPaced) {
      this.round.emitAllPlayerProgress()
    }
    if (this.pendingResultRequests.size > 0) {
      socket.emit(
        EVENTS.MANAGER.RESULT_REQUESTS_UPDATE,
        Array.from(this.pendingResultRequests.values()),
      )
    }
    console.log(`Manager reconnected to game ${this.inviteCode}`)
  }

  private reconnectPlayer(socket: Socket) {
    const clientId = getClientId(socket)
    const player = this.playerManager.findByClientId(clientId)

    if (!player) {
      return
    }

    socket.join(this.gameId)

    const oldSocketId = player.id
    const replacesConnection = player.connected && oldSocketId !== socket.id
    this.playerManager.updateSocketId(oldSocketId, socket.id)
    this.round.updatePlayerId(oldSocketId, socket.id)
    player.connected = true
    this.notifyPlayerUpdated(oldSocketId, player)

    if (replacesConnection) {
      this.io.in(oldSocketId).disconnectSockets(true)
    }

    // Migrate playerStatus from old socket ID to new one BEFORE reading it
    const oldStatus = this.playerStatus.get(oldSocketId)
    if (oldStatus) {
      this.playerStatus.delete(oldSocketId)
      this.playerStatus.set(socket.id, oldStatus)
    }

    let status: { name: Status; data: StatusDataMap[Status] } =
      this.playerStatus.get(socket.id) ??
      this.lastBroadcastStatus ?? {
        name: STATUS.WAIT,
        data: { text: "game:waitingForPlayers" },
      }

    if (this.round.isFinished()) {
      status = this.lastBroadcastStatus ?? {
        name: STATUS.FINISHED,
        data: { subject: this.quizzSubject, top: [] },
      }
    } else if (this.round.isPlayerFinished(socket.id)) {
      status = {
        name: STATUS.WAIT,
        data: { text: "game:quizSubmittedWait" },
      }
    }

    this.playerStatus.set(socket.id, status)

    socket.emit(EVENTS.PLAYER.SUCCESS_RECONNECT, {
      gameId: this.gameId,
      gameMode: this.gameMode,
      detectScreenSplit: this._settings.detectScreenSplit,
      antiCheatMode: this._settings.antiCheatMode,
      antiCheatPenaltyPoints: this._settings.antiCheatPenaltyPoints,
      hidePlayerResults: this._settings.hidePlayerResults,
      currentQuestion: this.round.getReconnectInfo(),
      status,
      player: { username: player.username, points: player.points },
    })
    const timerState = this.round.getUltimateTimerState()
    if (timerState.active) {
      socket.emit(EVENTS.GAME.ULTIMATE_TIMER_UPDATE, timerState)
    }

    if (this.approvedPlayerIds.has(oldSocketId)) {
      this.approvedPlayerIds.delete(oldSocketId)
      this.approvedPlayerIds.add(socket.id)
      const evaluation = this.round.getPlayerEvaluation(socket.id)
      if (evaluation) {
        socket.emit(EVENTS.PLAYER.RESULTS_EVALUATION, {
          approved: true,
          evaluation,
        })
      }
    } else if (this.pendingResultRequests.has(oldSocketId)) {
      const existing = this.pendingResultRequests.get(oldSocketId)!
      this.pendingResultRequests.delete(oldSocketId)
      this.pendingResultRequests.set(socket.id, {
        ...existing,
        playerId: socket.id,
      })
      this.io
        .to(this._manager.id)
        .emit(
          EVENTS.MANAGER.RESULT_REQUESTS_UPDATE,
          Array.from(this.pendingResultRequests.values()),
        )
    }

    this.playerManager.broadcastCount()

    // If game was auto-paused due to player disconnect, check if we can resume
    if (this.round.isPaused && this.round.pauseReason === "player_offline") {
      const remainingDisconnectedUnanswered = this.playerManager
        .getAll()
        .filter((p) => !p.connected && !this.round.hasPlayerAnswered(p.id))

      if (remainingDisconnectedUnanswered.length === 0) {
        if (this.disconnectAutoResumeTimer) {
          clearTimeout(this.disconnectAutoResumeTimer)
          this.disconnectAutoResumeTimer = null
        }
        this.round.resumeGame()
      }
    }

    console.log(
      `Player ${player.username} reconnected to game ${this.inviteCode}`,
    )
  }

  // Disconnect helpers

  setManagerDisconnected() {
    this._manager.connected = false
  }

  removePlayer(socketId: string): Player | undefined {
    const player = this.playerManager.remove(socketId)

    if (player) {
      this.io.to(this._manager.id).emit(EVENTS.MANAGER.REMOVE_PLAYER, player.id)
      this.playerManager.broadcastCount()
    }

    return player
  }

  setPlayerDisconnected(socketId: string, timedOut = false) {
    this.playerManager.setDisconnected(socketId)
    this.playerManager.broadcastCount()

    const player = this.playerManager.findById(socketId)

    if (
      this._settings.pauseOnDisconnect &&
      this.started &&
      this.round.isAskingQuestion() &&
      player &&
      !this.round.hasPlayerAnswered(socketId)
    ) {
      this.round.pauseGame("player_offline", player.username)

      if (!this.disconnectAutoResumeTimer) {
        this.disconnectAutoResumeTimer = setTimeout(() => {
          this.disconnectAutoResumeTimer = null
          if (
            this.round.isPaused &&
            this.round.pauseReason === "player_offline"
          ) {
            this.round.resumeGame()
          }
        }, 45 * SECOND_MS)
      }
    }

    this.round.endIfEveryoneAnswered()

    if (player) {
      this.notifyPlayerUpdated(socketId, player, timedOut)
    }
  }

  private notifyPlayerUpdated(
    previousId: string,
    player: Player,
    timedOut = false,
  ) {
    this.io
      .to(this._manager.id)
      .emit(EVENTS.MANAGER.PLAYER_UPDATED, { previousId, player, timedOut })
  }

  // Game flow

  abortCooldown() {
    this.cooldown.abort()
  }

  async start(socket: Socket) {
    if (!this.started) {
      const away = this.playerManager.getAll().filter((p) => !p.connected)

      for (const player of away) {
        this.removePlayer(player.id)
      }
    }

    await this.round.start(socket)
  }

  selectAnswer(socket: Socket, answerIds: number[], questionIndex?: number) {
    this.round.selectAnswer(socket, answerIds, questionIndex)
  }

  skipQuestion(socket: Socket, questionIndex: number) {
    this.round.skipQuestion(socket, questionIndex)
  }

  submitQuiz(socket: Socket) {
    this.round.submitQuiz(socket)
  }

  advance() {
    this.round.advance()
  }

  requestPlayerResults(socket: Socket): void {
    const clientId = getClientId(socket)
    const player = this.playerManager.findByClientId(clientId)

    if (!player) {
      return
    }

    if (this.approvedPlayerIds.has(player.id)) {
      const evaluation = this.round.getPlayerEvaluation(player.id)
      if (evaluation) {
        socket.emit(EVENTS.PLAYER.RESULTS_EVALUATION, {
          approved: true,
          evaluation,
        })
        return
      }
    }

    this.pendingResultRequests.set(player.id, {
      playerId: player.id,
      username: player.username,
      requestedAt: Date.now(),
    })

    this.io
      .to(this._manager.id)
      .emit(
        EVENTS.MANAGER.RESULT_REQUESTS_UPDATE,
        Array.from(this.pendingResultRequests.values()),
      )
  }

  respondResultRequest(
    socket: Socket,
    data: { playerId?: string; allowAll?: boolean; approved: boolean },
  ): void {
    if (socket.id !== this._manager.id) {
      return
    }

    if (data.allowAll) {
      if (data.approved) {
        for (const req of this.pendingResultRequests.values()) {
          this.approvedPlayerIds.add(req.playerId)
          const evaluation = this.round.getPlayerEvaluation(req.playerId)
          if (evaluation) {
            this.io.to(req.playerId).emit(EVENTS.PLAYER.RESULTS_EVALUATION, {
              approved: true,
              evaluation,
            })
          }
        }
      } else {
        for (const req of this.pendingResultRequests.values()) {
          this.io.to(req.playerId).emit(EVENTS.PLAYER.RESULTS_EVALUATION, {
            approved: false,
            message: "Host declined the request at this time.",
          })
        }
      }
      this.pendingResultRequests.clear()
    } else if (data.playerId) {
      const req = this.pendingResultRequests.get(data.playerId)
      if (req) {
        if (data.approved) {
          this.approvedPlayerIds.add(req.playerId)
          const evaluation = this.round.getPlayerEvaluation(req.playerId)
          if (evaluation) {
            this.io.to(req.playerId).emit(EVENTS.PLAYER.RESULTS_EVALUATION, {
              approved: true,
              evaluation,
            })
          }
        } else {
          this.io.to(req.playerId).emit(EVENTS.PLAYER.RESULTS_EVALUATION, {
            approved: false,
            message: "Host declined the request at this time.",
          })
        }
        this.pendingResultRequests.delete(data.playerId)
      }
    }

    this.io
      .to(this._manager.id)
      .emit(
        EVENTS.MANAGER.RESULT_REQUESTS_UPDATE,
        Array.from(this.pendingResultRequests.values()),
      )
  }

  getPlayerEvaluation(socket: Socket, playerIdentifier: string): void {
    if (socket.id !== this._manager.id) {
      return
    }

    const evaluation = this.round.getPlayerEvaluation(playerIdentifier)
    socket.emit(EVENTS.MANAGER.PLAYER_EVALUATION, {
      playerId: playerIdentifier,
      evaluation,
    })
  }
}

export default Game
