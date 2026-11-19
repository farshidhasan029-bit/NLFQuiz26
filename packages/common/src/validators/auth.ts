import { SESSION_ROLES } from "@razzia/common/constants"
import z from "zod"

export const usernameValidator = z
  .string()
  .min(1, "errors:auth.usernameTooShort")
  .max(24, "errors:auth.usernameTooLong")

export const inviteCodeValidator = z
  .string()
  .length(6, "errors:auth.invalidInviteCode")

export const sessionClaimsValidator = z.object({
  sub: z.string().min(1),
  role: z.enum(SESSION_ROLES),
  iat: z.number(),
  exp: z.number(),
})

export const joinTicketClaimsValidator = z.object({
  sub: z.string().min(1),
  gameId: z.string().min(1),
  username: usernameValidator.optional(),
  deviceId: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
})

export const managerLoginValidator = z.object({
  username: z.string().optional(),
  password: z.string().min(1, "errors:manager.invalidPassword"),
})

export const registerHostValidator = z.object({
  username: z.string().min(3, "errors:manager.usernameTooShort").max(32, "errors:manager.usernameTooLong"),
  password: z.string().min(6, "errors:manager.passwordTooShort"),
})

export const sessionRequestValidator = z.object({
  token: z.string().optional(),
})
