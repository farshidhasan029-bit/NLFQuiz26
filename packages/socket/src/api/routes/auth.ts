import { zValidator } from "@hono/zod-validator"
import { SESSION_ROLES } from "@razzia/common/constants"
import type { SessionResponse } from "@razzia/common/types/auth"
import {
  managerLoginValidator,
  registerHostValidator,
  sessionRequestValidator,
} from "@razzia/common/validators/auth"
import { readClaims, requireManager } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import { managerPassword } from "@razzia/socket/env"
import {
  mintToken,
  newClientId,
  verifyIgnoringExpiry,
  verifyToken,
} from "@razzia/socket/services/auth"
import {
  createHost,
  deleteHost,
  findHostByUsername,
  getHosts,
} from "@razzia/socket/services/config"
import bcrypt from "bcryptjs"
import { Hono, type Context } from "hono"
import { JwtTokenExpired } from "hono/utils/jwt/types"
import { StatusCodes } from "http-status-codes"

const readRequestToken = async (c: Context): Promise<string | undefined> => {
  try {
    const result = sessionRequestValidator.safeParse(await c.req.json())

    if (result.success && result.data.token) {
      return result.data.token
    }
  } catch {
    /* Empty */
  }

  const header = c.req.header("Authorization")

  return header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : undefined
}

const freshPlayerSession = (): Promise<SessionResponse> =>
  mintToken(newClientId(), SESSION_ROLES.PLAYER)

const routes = new Hono()
  .post("/session", async (c) => {
    const token = await readRequestToken(c)

    if (!token) {
      return c.json(await freshPlayerSession())
    }

    try {
      const claims = await verifyToken(token)

      return c.json({
        token,
        clientId: claims.sub,
        role: claims.role,
        expiresAt: claims.exp,
      } satisfies SessionResponse)
    } catch (error) {
      if (error instanceof JwtTokenExpired) {
        try {
          const claims = await verifyIgnoringExpiry(token)

          return c.json(await mintToken(claims.sub, SESSION_ROLES.PLAYER))
        } catch {
          /* Empty */
        }
      }

      return c.json(await freshPlayerSession())
    }
  })
  .post(
    "/manager",
    zValidator("json", managerLoginValidator, i18nHook),
    async (c) => {
      const { username, password } = c.req.valid("json")

      // ── Path A: Named host login (username + bcrypt password) ───────────────
      if (username) {
        const host = findHostByUsername(username)

        if (!host) {
          return c.json(
            { error: "errors:manager.invalidCredentials" },
            StatusCodes.FORBIDDEN,
          )
        }

        const passwordMatch = await bcrypt.compare(password, host.passwordHash)

        if (!passwordMatch) {
          return c.json(
            { error: "errors:manager.invalidCredentials" },
            StatusCodes.FORBIDDEN,
          )
        }

        // Use stable host.id as JWT sub so quizzes/results stay scoped to this host
        return c.json(await mintToken(host.id, SESSION_ROLES.MANAGER))
      }

      // ── Path B: Legacy single-password fallback ──────────────────────────────
      if (!managerPassword) {
        return c.json(
          { error: "errors:manager.passwordNotConfigured" },
          StatusCodes.FORBIDDEN,
        )
      }

      if (password !== managerPassword) {
        return c.json(
          { error: "errors:manager.invalidPassword" },
          StatusCodes.FORBIDDEN,
        )
      }

      const claims = await readClaims(c)

      return c.json(
        await mintToken(claims?.sub ?? newClientId(), SESSION_ROLES.MANAGER),
      )
    },
  )
  // ── Host management endpoints (require manager JWT) ─────────────────────────
  .post(
    "/register-host",
    requireManager,
    zValidator("json", registerHostValidator, i18nHook),
    async (c) => {
      const { username, password } = c.req.valid("json")
      const passwordHash = await bcrypt.hash(password, 10)

      try {
        const host = createHost(username, passwordHash)
        return c.json({ id: host.id, username: host.username, createdAt: host.createdAt }, StatusCodes.CREATED)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "errors:manager.usernameAlreadyExists"
        return c.json({ error: message }, StatusCodes.CONFLICT)
      }
    },
  )
  .get("/hosts", requireManager, (c) => {
    const hosts = getHosts().map(({ id, username, createdAt }) => ({ id, username, createdAt }))
    return c.json({ hosts })
  })
  .delete("/hosts/:hostId", requireManager, (c) => {
    const { hostId } = c.req.param()

    try {
      deleteHost(hostId)
      return c.body(null, StatusCodes.NO_CONTENT)
    } catch {
      return c.json({ error: "errors:manager.hostNotFound" }, StatusCodes.NOT_FOUND)
    }
  })
  .post("/logout", async (c) => {
    const claims = await readClaims(c)

    if (!claims) {
      return c.json(
        { error: "errors:auth.unauthorized" },
        StatusCodes.UNAUTHORIZED,
      )
    }

    return c.json(await mintToken(claims.sub, SESSION_ROLES.PLAYER))
  })

export const auth = routes
