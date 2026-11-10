// oxlint-disable typescript/no-unnecessary-condition
import {
  EVENTS,
  MAX_POINTS,
  MEDIA_TYPES,
  NO_TIME_LIMIT,
  QUIZZ_MODES,
} from "@razzia/common/constants"
import { isEstimationOptions } from "@razzia/common/questions/options"
import type {
  Answer,
  GameResult,
  GameSettings,
  GameUpdateQuestion,
  Player,
  Question,
  QuestionResult,
  Quizz,
  QuizzMode,
  SanitizedQuestion,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import {
  type Status,
  STATUS,
  type StatusDataMap,
} from "@razzia/common/types/game/status"
import { CooldownTimer } from "@razzia/socket/services/game/cooldown-timer"
import { PlayerManager } from "@razzia/socket/services/game/player-manager"
import {
  countAnswers,
  scoreQuestion,
  type ScoredPlayer,
} from "@razzia/socket/services/scoring/round"
import { orderToPoint, timeToPoint } from "@razzia/socket/utils/game"
import sleep, { SECOND_MS } from "@razzia/socket/utils/sleep"
import { nanoid } from "nanoid"

type BroadcastFn = <T extends Status>(
  _status: T,
  _data: StatusDataMap[T],
) => void
type SendFn = <T extends Status>(
  _target: string,
  _status: T,
  _data: StatusDataMap[T],
) => void

export interface RoundManagerOptions {
  quizz: Quizz
  players: PlayerManager
  cooldown: CooldownTimer
  io: Server
  gameId: string
  getManagerId: () => string
  broadcast: BroadcastFn
  send: SendFn
  onNewQuestion: () => void
  onGameFinished: (_result: GameResult) => void
  getSettings: () => GameSettings
}

interface RoundStep {
  name: string
  gameModes: QuizzMode[]
  skip?: () => boolean
  enter: () => void
  delay: (_settings: GameSettings) => number
}

export class RoundManager {
  private readonly opts: RoundManagerOptions
  private readonly steps: RoundStep[]
  private started = false
  private currentQuestion = 0
  private currentStep = -1
  private playersAnswers: Answer[] = []
  private startTime = 0
  private acceptingAnswers = false
  private leaderboard: Player[] = []
  private tempOldLeaderboard: Player[] | null = null
  private questionsHistory: QuestionResult[] = []
  private autoAdvanceTimer: NodeJS.Timeout | null = null
  private paused = false
  private ultimateTimerInterval: NodeJS.Timeout | null = null
  private ultimateRemaining = 0
  private ultimateTotal = 0
  private playerPacedMap = new Map<
    string,
    { answers: Map<number, number[]>; skipped: Set<number>; finished: boolean }
  >()
  private sanitizedQuestions: SanitizedQuestion[] = []

  getUltimateTimerState() {
    const settings = this.opts.getSettings()
    return {
      active: Boolean(settings.ultimateTimer?.enable),
      remaining: this.ultimateRemaining,
      total: this.ultimateTotal,
      paused: this.paused,
    }
  }

  private emitUltimateTimer() {
    this.opts.io.to(this.opts.gameId).emit(
      EVENTS.GAME.ULTIMATE_TIMER_UPDATE,
      this.getUltimateTimerState(),
    )
  }

  clearUltimateTimer(): void {
    if (this.ultimateTimerInterval) {
      clearInterval(this.ultimateTimerInterval)
      this.ultimateTimerInterval = null
    }
  }

  private startUltimateTimer(): void {
    this.clearUltimateTimer()
    const settings = this.opts.getSettings()
    if (!settings.ultimateTimer?.enable || settings.ultimateTimer.duration <= 0) {
      return
    }

    this.ultimateTotal = settings.ultimateTimer.duration
    this.ultimateRemaining = settings.ultimateTimer.duration

    this.emitUltimateTimer()

    this.ultimateTimerInterval = setInterval(() => {
      if (this.paused) {
        return
      }

      this.ultimateRemaining -= 1
      this.emitUltimateTimer()

      if (this.ultimateRemaining <= 0) {
        this.clearUltimateTimer()
        this.handleUltimateTimerExpired()
      }
    }, SECOND_MS)
  }

  private handleUltimateTimerExpired(): void {
    if (!this.started) {
      return
    }

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.ULTIMATE_TIMER_EXPIRED)

    if (this.opts.getSettings().selfPaced) {
      this.finalizeSelfPacedQuiz()
      return
    }

    if (this.isAskingQuestion()) {
      this.acceptingAnswers = false
      this.opts.cooldown.abort()
      const currentPlayers = this.opts.players.getAll()
      const sortedPlayers = scoreQuestion(
        this.question,
        currentPlayers,
        this.playersAnswers,
      )
      this.opts.players.replace(sortedPlayers)
      this.recordHistory(currentPlayers, sortedPlayers)
      this.leaderboard = sortedPlayers
      this.playersAnswers = []
    }

    this.finish()
  }

  constructor(opts: RoundManagerOptions) {
    this.opts = opts

    const steps: RoundStep[] = [
      {
        name: "reveal",
        gameModes: [QUIZZ_MODES.QUIZ, QUIZZ_MODES.SURVEY],
        enter: () => {
          this.showResults()
        },
        delay: (settings) => settings.autoAdvance.responsesDelay,
      },
      {
        name: "leaderboard",
        gameModes: [QUIZZ_MODES.QUIZ],
        skip: () => this.isLastQuestion() || this.isSameCategoryNext(),
        enter: () => {
          this.showLeaderboard()
        },
        delay: (settings) => settings.autoAdvance.leaderboardDelay,
      },
    ]

    this.steps = steps.filter((step) =>
      step.gameModes.includes(opts.quizz.gameMode),
    )
  }

  isStarted(): boolean {
    return this.started
  }

  private get question(): Question {
    return this.opts.quizz.questions[this.currentQuestion]
  }

  isAskingQuestion(): boolean {
    return this.currentStep < 0
  }

  hasPlayerAnswered(playerId: string): boolean {
    return this.playersAnswers.some((a) => a.playerId === playerId)
  }

  private isLastQuestion(): boolean {
    return !this.opts.quizz.questions[this.currentQuestion + 1]
  }

  private isSameCategoryNext(): boolean {
    const category = this.question.category?.trim()
    const next = this.opts.quizz.questions[this.currentQuestion + 1]

    return Boolean(category) && next?.category?.trim() === category
  }

  private isSurvey(): boolean {
    return this.opts.quizz.gameMode === QUIZZ_MODES.SURVEY
  }

  // ── Auto advance ─────────────────────────────────────────────────────────

  clearAutoAdvance(): void {
    if (!this.autoAdvanceTimer) {
      return
    }

    clearInterval(this.autoAdvanceTimer)
    this.autoAdvanceTimer = null
    this.emitAutoAdvance(null)
  }

  private emitAutoAdvance(state: { seconds: number; total: number } | null) {
    this.opts.io
      .to(this.opts.getManagerId())
      .emit(EVENTS.MANAGER.AUTO_ADVANCE, state)
  }

  private scheduleAutoAdvance(delay: number): void {
    this.clearAutoAdvance()

    if (!this.opts.getSettings().autoAdvance.enable) {
      return
    }

    let remaining = delay

    this.emitAutoAdvance({ seconds: remaining, total: delay })

    this.autoAdvanceTimer = setInterval(() => {
      if (this.paused) {
        return
      }

      remaining -= 1

      if (remaining > 0) {
        this.emitAutoAdvance({ seconds: remaining, total: delay })

        return
      }

      this.clearAutoAdvance()
      this.advance()
    }, SECOND_MS)
  }

  private _pauseReason: string | null = null
  private _pauseUsername: string | null = null

  get isPaused(): boolean {
    return this.paused
  }

  get pauseReason(): string | null {
    return this._pauseReason
  }

  get pauseUsername(): string | null {
    return this._pauseUsername
  }

  pauseGame(reason = "manager", username?: string): void {
    if (!this.started || this.paused) {
      return
    }

    this.paused = true
    this._pauseReason = reason
    this._pauseUsername = username ?? null
    this.opts.cooldown.pause()
    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.PAUSE_UPDATE, {
      paused: true,
      reason,
      username,
    })
    this.emitUltimateTimer()
  }

  resumeGame(): void {
    if (!this.started || !this.paused) {
      return
    }

    this.paused = false
    this._pauseReason = null
    this._pauseUsername = null
    this.opts.cooldown.resume()
    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.PAUSE_UPDATE, {
      paused: false,
    })
    this.emitUltimateTimer()
  }

  // ── Flow ─────────────────────────────────────────────────────────────────

  getReconnectInfo(): GameUpdateQuestion | null {
    if (!this.started) {
      return null
    }

    return {
      current: this.currentQuestion + 1,
      total: this.opts.quizz.questions.length,
    }
  }

  async start(socket: Socket): Promise<void> {
    if (this.started) {
      return
    }

    if (this.opts.players.count() === 0) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.noPlayersConnected")

      return
    }

    this.started = true
    this.startUltimateTimer()

    this.opts.broadcast(STATUS.SHOW_START, {
      time: 3,
      subject: this.opts.quizz.subject,
    })

    await sleep(3)

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.START_COOLDOWN)
    await this.opts.cooldown.start(3)

    if (!this.started) {
      return
    }

    if (this.opts.getSettings().selfPaced) {
      this.startSelfPaced()
      return
    }

    void this.newQuestion()
  }

  private startSelfPaced(): void {
    this.sanitizedQuestions = this.opts.quizz.questions.map((q) => {
      const { solutions, ...rest } = q
      return rest
    })

    this.playerPacedMap.clear()
    for (const player of this.opts.players.getAll()) {
      this.playerPacedMap.set(player.id, {
        answers: new Map<number, number[]>(),
        skipped: new Set<number>(),
        finished: false,
      })
    }

    const payload = {
      questions: this.sanitizedQuestions,
      totalQuestions: this.sanitizedQuestions.length,
      gameMode: this.opts.quizz.gameMode,
      detectScreenSplit: this.opts.getSettings().detectScreenSplit,
      hidePlayerResults: this.opts.getSettings().hidePlayerResults,
    }

    this.opts.broadcast(STATUS.SELF_PACED_QUIZ, payload)
    this.emitAllPlayerProgress()
  }

  private emitPlayerProgress(playerId: string): void {
    const player = this.opts.players.findById(playerId)
    const state = this.playerPacedMap.get(playerId)
    if (!player || !state) {
      return
    }

    this.opts.io
      .to(this.opts.getManagerId())
      .emit(EVENTS.GAME.PLAYER_PROGRESS_UPDATE, {
        playerId: player.id,
        username: player.username,
        answeredCount: state.answers.size,
        skippedCount: state.skipped.size,
        totalQuestions: this.sanitizedQuestions.length,
        finished: state.finished,
      })
  }

  private emitAllPlayerProgress(): void {
    for (const player of this.opts.players.getAll()) {
      this.emitPlayerProgress(player.id)
    }
  }

  finalizeSelfPacedQuiz(): void {
    if (!this.started) {
      return
    }

    const currentPlayers = this.opts.players.getAll()

    // Score every question based on participants' recorded answers
    for (let i = 0; i < this.opts.quizz.questions.length; i++) {
      const q = this.opts.quizz.questions[i]
      const questionAnswers: Answer[] = []

      for (const player of currentPlayers) {
        const pState = this.playerPacedMap.get(player.id)
        const pAns = pState?.answers.get(i)
        if (pAns) {
          const points = q.maxPoints ?? MAX_POINTS
          questionAnswers.push({
            playerId: player.id,
            answerIds: pAns,
            points,
          })
        }
      }

      const sorted = scoreQuestion(q, currentPlayers, questionAnswers)
      this.opts.players.replace(sorted)

      this.questionsHistory.push({
        ...q,
        solutions: this.isSurvey() ? undefined : q.solutions,
        playerAnswers: currentPlayers.map((player) => {
          const pScore = sorted.find((s) => s.id === player.id)
          const pAns = this.playerPacedMap.get(player.id)?.answers.get(i)
          return {
            playerName: player.username,
            answerIds: pAns ?? null,
            ...(pScore && {
              correct: pScore.lastCorrect,
              points: pScore.lastPoints,
            }),
          }
        }),
      })
    }

    const finalSorted = [...currentPlayers].sort((a, b) => b.points - a.points)
    this.opts.players.replace(finalSorted)
    this.leaderboard = finalSorted

    this.finish()
  }

  advance(): void {
    if (!this.started) {
      return
    }

    if (this.opts.getSettings().selfPaced) {
      this.finalizeSelfPacedQuiz()
      return
    }

    this.clearAutoAdvance()

    if (this.isAskingQuestion()) {
      this.acceptingAnswers = false
      this.opts.cooldown.abort()

      return
    }

    this.runStep(this.currentStep + 1)
  }

  private runStep(index: number): void {
    const step = this.steps[index]

    if (!step) {
      this.nextQuestion()

      return
    }

    if (step.skip?.()) {
      this.runStep(index + 1)

      return
    }

    this.currentStep = index
    step.enter()
    this.scheduleAutoAdvance(step.delay(this.opts.getSettings()))
  }

  private nextQuestion(): void {
    if (this.isLastQuestion()) {
      this.finish()

      return
    }

    this.currentQuestion += 1
    void this.newQuestion()
  }

  private async newQuestion(): Promise<void> {
    if (!this.started) {
      return
    }

    this.currentStep = -1

    this.opts.onNewQuestion()

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.UPDATE_QUESTION, {
      current: this.currentQuestion + 1,
      total: this.opts.quizz.questions.length,
    })

    this.opts.broadcast(STATUS.SHOW_PREPARED, {
      totalAnswers: this.question.answers.length,
      questionNumber: this.currentQuestion + 1,
      questionType: this.question.type,
    })

    await sleep(2)

    if (!this.started) {
      return
    }

    const imageMedia = (() => {
      if (this.question.media?.type !== MEDIA_TYPES.IMAGE) {
        return undefined
      }

      return this.question.media
    })()

    this.opts.broadcast(STATUS.SHOW_QUESTION, {
      question: this.question.question,
      media: imageMedia,
      cooldown: this.question.cooldown,
    })

    await sleep(this.question.cooldown)

    if (!this.started) {
      return
    }

    this.startTime = Date.now()
    this.acceptingAnswers = true

    this.opts.broadcast(STATUS.SELECT_ANSWER, {
      question: this.question.question,
      answers: this.question.answers,
      media: this.question.media,
      time: this.question.time,
      totalPlayer: this.opts.players.count(),
      questionType: this.question.type,
      options: this.question.options,
      answersOnly: this.opts.getSettings().answersOnly,
      detectScreenSplit: this.opts.getSettings().detectScreenSplit,
    })

    await this.opts.cooldown.start(this.question.time)

    this.acceptingAnswers = false

    if (!this.started) {
      return
    }

    this.runStep(0)
  }

  // ── Steps ────────────────────────────────────────────────────────────────

  private recordHistory(players: Player[], scored: ScoredPlayer[] = []): void {
    this.questionsHistory.push({
      ...this.question,
      solutions: this.isSurvey() ? undefined : this.question.solutions,
      playerAnswers: players.map((player) => {
        const score = scored.find((s) => s.id === player.id)

        return {
          playerName: player.username,
          answerIds:
            this.playersAnswers.find((a) => a.playerId === player.id)
              ?.answerIds ?? null,
          ...(score && {
            correct: score.lastCorrect,
            points: score.lastPoints,
          }),
        }
      }),
    })
  }

  private showResults(): void {
    const currentPlayers = this.opts.players.getAll()
    const answerCounts = countAnswers(this.playersAnswers)

    if (this.isSurvey()) {
      this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
        ...this.question,
        solutions: undefined,
        responses: answerCounts,
      })

      currentPlayers.forEach((player) => {
        this.opts.send(player.id, STATUS.WAIT, {
          text: "game:answerNoted",
        })
      })

      this.recordHistory(currentPlayers)
      this.playersAnswers = []

      return
    }

    const oldLeaderboard = (() => {
      if (this.leaderboard.length === 0) {
        return currentPlayers.map((p) => ({ ...p }))
      }

      return this.leaderboard.map((p) => ({ ...p }))
    })()

    const sortedPlayers = scoreQuestion(
      this.question,
      currentPlayers,
      this.playersAnswers,
    )

    this.opts.players.replace(sortedPlayers)

    const hidePlayerResults = this.opts.getSettings().hidePlayerResults

    sortedPlayers.forEach((player, index) => {
      if (hidePlayerResults) {
        this.opts.send(player.id, STATUS.WAIT, {
          text: "game:answerRecordedWaitHost",
        })
      } else {
        const aheadPlayer = sortedPlayers[index - 1]

        this.opts.send(player.id, STATUS.SHOW_RESULT, {
          correct: player.lastCorrect,
          message: player.lastCorrect ? "game:correct" : "game:wrong",
          points: player.lastPoints,
          myPoints: player.points,
          rank: index + 1,
          aheadOfMe: aheadPlayer ? aheadPlayer.username : null,
        })
      }
    })

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
      ...this.question,
      responses: answerCounts,
    })

    this.recordHistory(currentPlayers, sortedPlayers)

    this.leaderboard = sortedPlayers
    this.tempOldLeaderboard ??= oldLeaderboard
    this.playersAnswers = []
  }

  private showLeaderboard(): void {
    const oldLeaderboard = this.tempOldLeaderboard ?? this.leaderboard

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_LEADERBOARD, {
      oldLeaderboard: oldLeaderboard.slice(0, 5),
      leaderboard: this.leaderboard.slice(0, 5),
    })

    this.tempOldLeaderboard = null
  }

  private finishSurvey(): void {
    const players = this.opts.players.getAll()

    const summary = {
      subject: this.opts.quizz.subject,
      totalPlayers: players.length,
      totalQuestions: this.opts.quizz.questions.length,
    }

    this.opts.send(this.opts.getManagerId(), STATUS.SUMMARY, summary)

    players.forEach((player) => {
      this.opts.send(player.id, STATUS.SUMMARY, summary)
    })
  }

  private finish(): void {
    this.started = false
    this.clearAutoAdvance()
    this.clearUltimateTimer()

    const finalPlayers = this.isSurvey()
      ? this.opts.players.getAll()
      : this.leaderboard

    this.opts.onGameFinished({
      id: `${Date.now()}-${nanoid(8)}`,
      gameMode: this.opts.quizz.gameMode,
      subject: this.opts.quizz.subject,
      date: new Date().toISOString(),
      players: finalPlayers.map((player, index) => ({
        username: player.username,
        points: player.points,
        rank: index + 1,
      })),
      questions: this.questionsHistory,
    })

    if (this.isSurvey()) {
      this.finishSurvey()

      return
    }

    const top = this.leaderboard
      .slice(0, 3)
      .map(({ username, points }) => ({ username, points }))

    this.opts.send(this.opts.getManagerId(), STATUS.FINISHED, {
      subject: this.opts.quizz.subject,
      top,
    })

    const hidePlayerResults = this.opts.getSettings().hidePlayerResults

    this.leaderboard.forEach((player, index) => {
      this.opts.send(player.id, STATUS.FINISHED, {
        subject: this.opts.quizz.subject,
        top: hidePlayerResults ? [] : top,
        rank: hidePlayerResults ? undefined : index + 1,
      })
    })
  }

  // ── Player actions ───────────────────────────────────────────────────────

  private normalizeAnswer(answerIds: number[]): number[] | null {
    const { options } = this.question

    if (!isEstimationOptions(options)) {
      return answerIds
    }

    const value = answerIds.at(0)

    if (
      answerIds.length !== 1 ||
      value === undefined ||
      !Number.isFinite(value)
    ) {
      return null
    }

    return [Math.min(options.max, Math.max(options.min, value))]
  }

  selectAnswer(socket: Socket, answerIds: number[], questionIndex?: number): void {
    if (this.opts.getSettings().selfPaced) {
      this.selectAnswerSelfPaced(socket, answerIds, questionIndex)
      return
    }

    const player = this.opts.players.findById(socket.id)

    if (!player || !this.acceptingAnswers) {
      return
    }

    if (this.playersAnswers.find((a) => a.playerId === socket.id)) {
      return
    }

    const submitted = this.normalizeAnswer(answerIds)

    if (!submitted) {
      return
    }

    const points = (() => {
      if (isEstimationOptions(this.question.options)) {
        return this.question.maxPoints ?? MAX_POINTS
      }

      if (this.question.time === NO_TIME_LIMIT) {
        return orderToPoint(
          this.playersAnswers.length,
          this.opts.players.count(),
          this.question.maxPoints,
        )
      }

      return timeToPoint(this.startTime, this.question)
    })()

    this.playersAnswers.push({
      playerId: player.id,
      answerIds: submitted,
      points,
    })

    this.opts.send(socket.id, STATUS.WAIT, {
      text: "game:waitingForAnswers",
    })

    socket
      .to(this.opts.gameId)
      .emit(EVENTS.GAME.PLAYER_ANSWER, this.playersAnswers.length)
    this.opts.players.broadcastCount()
    this.endIfEveryoneAnswered()
  }

  private selectAnswerSelfPaced(
    socket: Socket,
    answerIds: number[],
    questionIndex?: number,
  ): void {
    if (!this.started) {
      return
    }

    const state = this.playerPacedMap.get(socket.id)
    if (!state || state.finished) {
      return
    }

    if (
      questionIndex === undefined ||
      questionIndex < 0 ||
      questionIndex >= this.sanitizedQuestions.length
    ) {
      return
    }

    const question = this.opts.quizz.questions[questionIndex]
    if (!question) {
      return
    }

    let submitted = answerIds
    if (isEstimationOptions(question.options)) {
      const value = answerIds.at(0)
      if (
        answerIds.length === 1 &&
        value !== undefined &&
        Number.isFinite(value)
      ) {
        submitted = [
          Math.min(question.options.max, Math.max(question.options.min, value)),
        ]
      } else {
        return
      }
    }

    state.answers.set(questionIndex, submitted)
    state.skipped.delete(questionIndex)

    this.emitPlayerProgress(socket.id)
  }

  skipQuestion(socket: Socket, questionIndex: number): void {
    if (!this.started || !this.opts.getSettings().selfPaced) {
      return
    }

    const state = this.playerPacedMap.get(socket.id)
    if (!state || state.finished) {
      return
    }

    if (questionIndex < 0 || questionIndex >= this.sanitizedQuestions.length) {
      return
    }

    if (!state.answers.has(questionIndex)) {
      state.skipped.add(questionIndex)
    }

    this.emitPlayerProgress(socket.id)
  }

  submitQuiz(socket: Socket): void {
    if (!this.started || !this.opts.getSettings().selfPaced) {
      return
    }

    const state = this.playerPacedMap.get(socket.id)
    if (!state || state.finished) {
      return
    }

    state.finished = true
    this.opts.send(socket.id, STATUS.WAIT, {
      text: "game:quizSubmittedWait",
    })
    this.emitPlayerProgress(socket.id)

    const allConnected = this.opts.players.getAll().filter((p) => p.connected)
    const allDone =
      allConnected.length > 0 &&
      allConnected.every((p) => this.playerPacedMap.get(p.id)?.finished)

    if (allDone) {
      this.finalizeSelfPacedQuiz()
    }
  }

  updatePlayerId(oldId: string, newId: string): void {
    this.playersAnswers = this.playersAnswers.map((answer) =>
      answer.playerId === oldId ? { ...answer, playerId: newId } : answer,
    )
    const existingPaced = this.playerPacedMap.get(oldId)
    if (existingPaced) {
      this.playerPacedMap.delete(oldId)
      this.playerPacedMap.set(newId, existingPaced)
    }
  }

  endIfEveryoneAnswered(): void {
    if (this.opts.getSettings().selfPaced) {
      const allConnected = this.opts.players.getAll().filter((p) => p.connected)
      const allDone =
        allConnected.length > 0 &&
        allConnected.every((p) => this.playerPacedMap.get(p.id)?.finished)

      if (allDone) {
        this.finalizeSelfPacedQuiz()
      }
      return
    }

    if (!this.acceptingAnswers) {
      return
    }

    const allPlayers = this.opts.players.getAll()
    const connected = allPlayers.filter((p) => p.connected)
    const disconnectedUnanswered = allPlayers.filter(
      (p) => !p.connected && !this.hasPlayerAnswered(p.id),
    )

    if (
      this.opts.getSettings().pauseOnDisconnect &&
      disconnectedUnanswered.length > 0
    ) {
      return
    }

    const everyoneAnswered = connected.every((player) =>
      this.playersAnswers.some((a) => a.playerId === player.id),
    )

    if (connected.length > 0 && everyoneAnswered) {
      this.opts.cooldown.abort()
    }
  }
}
