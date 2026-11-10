import { AUTO_ADVANCE_DELAY } from "@razzia/common/constants"
import {
  inviteCodeValidator,
  usernameValidator,
} from "@razzia/common/validators/auth"
import z from "zod"

export const createGameValidator = z.object({
  quizzId: z.string().min(1, "errors:quizz.notFound"),
})

export const checkGameValidator = z.object({
  inviteCode: inviteCodeValidator,
})

export const joinGameValidator = z.object({
  inviteCode: inviteCodeValidator,
  username: usernameValidator.optional(),
  deviceId: z.string().optional(),
  deviceJoinCount: z.number().int().optional(),
})

const delayValidator = z
  .number()
  .int()
  .min(AUTO_ADVANCE_DELAY.MIN, "errors:game.invalidAutoAdvanceDelay")
  .max(AUTO_ADVANCE_DELAY.MAX, "errors:game.invalidAutoAdvanceDelay")

export const gameSettingsSchema = z.object({
  generatedUsernames: z.boolean(),
  answersOnly: z.boolean(),
  detectScreenSplit: z.boolean(),
  pauseOnDisconnect: z.boolean().default(true),
  hidePlayerResults: z.boolean().default(true),
  autoAdvance: z.object({
    enable: z.boolean(),
    responsesDelay: delayValidator,
    leaderboardDelay: delayValidator,
  }),
  ultimateTimer: z.object({
    enable: z.boolean(),
    duration: z.number().int().min(10).max(7200),
  }).default({ enable: false, duration: 600 }),
  selfPaced: z.boolean().default(true),
  maxParticipants: z.number().int().min(0).max(1000).default(0),
})

export const gameSettingsValidator = gameSettingsSchema.partial()
