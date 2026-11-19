import { auth } from "@razzia/socket/api/routes/auth"
import { backup } from "@razzia/socket/api/routes/backup"
import { games } from "@razzia/socket/api/routes/games"
import { media } from "@razzia/socket/api/routes/media"
import { quizz } from "@razzia/socket/api/routes/quizz"
import { results } from "@razzia/socket/api/routes/results"
import { Hono } from "hono"

const routes = new Hono()
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/auth", auth)
  .route("/quizz", quizz)
  .route("/results", results)
  .route("/games", games)
  .route("/media", media)
  .route("/backup", backup)

export const api = routes

export type ApiType = typeof routes
