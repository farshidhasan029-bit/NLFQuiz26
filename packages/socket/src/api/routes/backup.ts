import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import {
  exportBackup,
  restoreBackup,
  type BackupBundle,
} from "@razzia/socket/services/config"
import { StatusCodes } from "http-status-codes"

const routes = apiFactory
  .createApp()
  .use(requireManager)
  .get("/export", (c) => {
    const { claims } = c.var
    const bundle = exportBackup(claims.sub)
    const filename = `nlfquiz-backup-${new Date().toISOString().slice(0, 10)}.json`
    c.header("Content-Disposition", `attachment; filename="${filename}"`)
    c.header("Content-Type", "application/json")
    return c.body(JSON.stringify(bundle, null, 2))
  })
  .post("/restore", async (c) => {
    const { claims } = c.var
    let bundle: BackupBundle

    try {
      bundle = (await c.req.json()) as BackupBundle
    } catch {
      return c.json(
        { error: "Invalid JSON backup file" },
        StatusCodes.BAD_REQUEST,
      )
    }

    if (bundle.version !== 1) {
      return c.json(
        { error: "Unsupported backup version" },
        StatusCodes.BAD_REQUEST,
      )
    }

    const result = restoreBackup(bundle, claims.sub)
    return c.json(result)
  })

export const backup = routes
