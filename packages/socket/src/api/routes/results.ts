import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import {
  deleteResult,
  getResultById,
  getResultsMeta,
} from "@razzia/socket/services/config"
import { StatusCodes } from "http-status-codes"

const routes = apiFactory
  .createApp()
  .use(requireManager)
  .get("/", (c) => {
    const { claims } = c.var
    return c.json({ results: getResultsMeta(claims.sub) })
  })
  .get("/:id", (c) => {
    const { claims } = c.var
    return c.json(getResultById(c.req.param("id"), claims.sub))
  })
  .delete("/:id", (c) => {
    const { claims } = c.var
    deleteResult(c.req.param("id"), claims.sub)
    return c.body(null, StatusCodes.NO_CONTENT)
  })

export const results = routes
