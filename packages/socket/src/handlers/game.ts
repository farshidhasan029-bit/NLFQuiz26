import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { verifyJoinTicket } from "@razzia/socket/services/auth"
import Game from "@razzia/socket/services/game"
import Registry from "@razzia/socket/services/registry"
import { withManagerGame, withPlayerGame } from "@razzia/socket/utils/game"
import { getClientId } from "@razzia/socket/utils/socket"

export const gameSocketHandlers = ({ io, socket }: SocketContext) => {
  const registry = Registry.getInstance()
  const clientId = getClientId(socket)

  const closeLobby = (game: Game) => {
    game.abortCooldown()
    io.to(game.gameId).emit(
      EVENTS.GAME.RESET,
      "errors:game.managerDisconnected",
    )
    registry.removeGame(game.gameId)
  }

  const handleManagerLeave = (game: Game) => {
    game.setManagerDisconnected()
    registry.markGameAsEmpty(game)

    if (!game.started) {
      closeLobby(game)
    }
  }

  const handleManagerDisconnect = (game: Game) => {
    game.setManagerDisconnected()
    registry.markGameAsEmpty(game)

    if (!game.started) {
      game.waitForManager(() => closeLobby(game))
    }
  }

  const handlePlayerLeave = (game: Game) => {
    if (!game.started) {
      const player = game.removePlayer(socket.id)

      if (player) {
        console.log(`Player ${player.username} left game ${game.gameId}`)
      }

      return
    }

    game.setPlayerDisconnected(socket.id)
  }

  socket.on(EVENTS.PLAYER.RECONNECT, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")
  })

  socket.on(EVENTS.MANAGER.RECONNECT, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.expired")
  })

  socket.on(EVENTS.PLAYER.LOGIN, ({ ticket }) => {
    verifyJoinTicket(ticket)
      .then((claims) => {
        if (claims.sub !== clientId) {
          socket.emit(EVENTS.GAME.RESET, "errors:auth.unauthorized")

          return
        }

        const game = registry.getGameById(claims.gameId)

        if (!game) {
          socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")

          return
        }

        const error = game.join(socket, claims.username, claims.deviceId)

        if (error) {
          socket.emit(EVENTS.GAME.RESET, error)
        }
      })
      .catch(() => {
        socket.emit(EVENTS.GAME.RESET, "errors:auth.joinTicketInvalid")
      })
  })

  socket.on(EVENTS.MANAGER.KICK_PLAYER, ({ gameId, playerId }) =>
    withManagerGame(gameId, socket, (game) => game.kickPlayer(playerId)),
  )

  socket.on(EVENTS.MANAGER.SET_LOCK, ({ gameId, locked }) =>
    withManagerGame(gameId, socket, (game) => game.setLocked(locked)),
  )

  socket.on(EVENTS.MANAGER.START_GAME, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.start(socket)),
  )

  socket.on(EVENTS.PLAYER.SELECTED_ANSWER, ({ gameId, data }) =>
    withPlayerGame(gameId, socket, (game) =>
      game.selectAnswer(socket, data.answerKeys, data.questionIndex),
    ),
  )

  socket.on(EVENTS.PLAYER.SKIP_QUESTION, ({ gameId, data }) =>
    withPlayerGame(gameId, socket, (game) =>
      game.skipQuestion(socket, data.questionIndex),
    ),
  )

  socket.on(EVENTS.PLAYER.SUBMIT_QUIZ, ({ gameId }) =>
    withPlayerGame(gameId, socket, (game) =>
      game.submitQuiz(socket),
    ),
  )

  socket.on(EVENTS.PLAYER.CHEATING_DETECTED, ({ gameId, reason }) =>
    withPlayerGame(gameId, socket, (game) =>
      game.expelCheater(socket, reason),
    ),
  )

  socket.on(EVENTS.PLAYER.SEND_REACTION, ({ gameId, emoji }) => {
    if (typeof emoji === "string" && emoji.length <= 8) {
      io.to(gameId).emit(EVENTS.GAME.REACTION, {
        id: Math.random().toString(36).substring(2, 9),
        emoji,
        x: Math.floor(Math.random() * 80) + 10,
      })
    }
  })

  socket.on(EVENTS.MANAGER.ADVANCE, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.advance()),
  )

  socket.on(EVENTS.MANAGER.PAUSE_GAME, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.pauseGame()),
  )

  socket.on(EVENTS.MANAGER.RESUME_GAME, ({ gameId }) =>
    withManagerGame(gameId, socket, (game) => game.resumeGame()),
  )

  socket.on(EVENTS.MANAGER.LEAVE, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      console.log(`Manager left game ${game.inviteCode}`)
      handleManagerLeave(game)
    }
  })

  socket.on(EVENTS.PLAYER.LEAVE, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      handlePlayerLeave(game)
    }
  })

  socket.on("disconnect", (reason) => {
    console.log(`A user disconnected : ${socket.id}`)

    const managerGame = registry.getGameByManagerSocketId(socket.id)

    if (managerGame) {
      console.log(`Manager disconnected from game ${managerGame.inviteCode}`)
      handleManagerDisconnect(managerGame)

      return
    }

    const playerGame = registry.getGameByPlayerSocketId(socket.id)

    if (playerGame) {
      playerGame.setPlayerDisconnected(socket.id, reason === "ping timeout")
    }
  })
}
