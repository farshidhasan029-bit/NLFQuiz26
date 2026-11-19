import { EXAMPLE_QUIZZ, QUIZZ_MODES } from "@razzia/common/constants"
import type {
  GameResult,
  GameResultMeta,
  QuizzMode,
  QuizzWithId,
} from "@razzia/common/types/game"
import {
  normalizeLegacyQuizz,
  quizzValidator,
} from "@razzia/common/validators/quizz"
import { invalidInput, notFound } from "@razzia/socket/services/errors"
import { normalizeFilename } from "@razzia/socket/utils/file"
import fs from "fs"
import { nanoid } from "nanoid"
import { join, resolve } from "path"

const inContainerPath = process.env.CONFIG_PATH

export const getPath = (path = "") =>
  inContainerPath
    ? resolve(inContainerPath, path)
    : resolve(process.cwd(), "../../config", path)

const readJson = (filePath: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
      string,
      unknown
    >
  } catch {
    return null
  }
}

// Lstat (not stat) so a symlink planted in the config dir is skipped instead
// of followed outside it.
const listJsonFiles = (dirPath: string): string[] =>
  fs.readdirSync(dirPath).filter((file) => {
    if (!file.endsWith(".json")) {
      return false
    }

    try {
      return fs.lstatSync(join(dirPath, file)).isFile()
    } catch {
      return false
    }
  })

const resolveFileId = (dirPath: string, file: string): string => {
  const data = readJson(join(dirPath, file))

  return typeof data?.id === "string" ? data.id : file.replace(/\.json$/u, "")
}

// Never builds a path from `id` — avoids path traversal by construction.
const findFileById = (subDir: string, id: string): string | undefined => {
  const dirPath = getPath(subDir)

  if (!fs.existsSync(dirPath)) {
    return undefined
  }

  return listJsonFiles(dirPath).find(
    (file) => resolveFileId(dirPath, file) === id,
  )
}

const requireFileById = (subDir: string, id: string, key: string): string => {
  const file = findFileById(subDir, id)

  if (!file) {
    throw notFound(key)
  }

  return file
}

export const initConfig = () => {
  const isConfigFolderExists = fs.existsSync(getPath())

  if (!isConfigFolderExists) {
    fs.mkdirSync(getPath())
  }

  const isQuizzExists = fs.existsSync(getPath("quizz"))

  if (!isQuizzExists) {
    fs.mkdirSync(getPath("quizz"))

    fs.writeFileSync(
      getPath("quizz/example.json"),
      JSON.stringify({ id: nanoid(), ...EXAMPLE_QUIZZ }, null, 2),
    )
  }
}

const subjectCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

export const getQuizzMeta = () =>
  getQuizz()
    .map(({ id, subject }) => ({ id, subject }))
    .sort((a, b) => subjectCollator.compare(a.subject, b.subject))

export const getQuizzById = (id: string): QuizzWithId => {
  const quizz = getQuizz().find((q) => q.id === id)

  if (!quizz) {
    throw notFound("errors:quizz.notFound")
  }

  return quizz
}

export const getQuizz = (): QuizzWithId[] => {
  const isExists = fs.existsSync(getPath("quizz"))

  if (!isExists) {
    return []
  }

  try {
    const files = listJsonFiles(getPath("quizz"))

    const quizz: QuizzWithId[] = files.flatMap((file) => {
      const filePath = getPath(`quizz/${file}`)
      const data = readJson(filePath)

      if (!data) {
        console.warn(`Invalid quizz config "${file}": unreadable`)

        return []
      }

      const result = quizzValidator.safeParse(normalizeLegacyQuizz(data))

      if (!result.success) {
        console.warn(`Invalid quizz config "${file}":`, result.error.issues)

        return []
      }

      if (typeof data.id === "string") {
        return [{ id: data.id, ...result.data }]
      }

      const id = nanoid()

      fs.writeFileSync(
        filePath,
        JSON.stringify({ id, ...result.data }, null, 2),
      )

      return [{ id, ...result.data }]
    })

    return quizz
  } catch (error) {
    console.error("Failed to read quizz config:", error)

    return []
  }
}

export const updateQuizz = (id: string, data: unknown): { id: string } => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw invalidInput(result.error.issues[0].message)
  }

  const file = requireFileById("quizz", id, "errors:quizz.notFound")

  fs.writeFileSync(
    join(getPath("quizz"), file),
    JSON.stringify({ id, ...result.data }, null, 2),
  )

  return { id }
}

export const deleteQuizz = (id: string): void => {
  const file = requireFileById("quizz", id, "errors:quizz.notFound")

  fs.unlinkSync(join(getPath("quizz"), file))
}

export const saveResult = (data: GameResult): void => {
  try {
    const resultsPath = getPath("results")

    if (!fs.existsSync(resultsPath)) {
      fs.mkdirSync(resultsPath)
    }

    fs.writeFileSync(
      join(resultsPath, `${nanoid()}.json`),
      JSON.stringify(data, null, 2),
    )

    console.log(`Saved result for "${data.subject}"`)
  } catch (error) {
    console.error("Failed to save result:", error)
  }
}

/** Results written before survey mode have no `gameMode` field. */
type StoredResult = Omit<GameResult, "gameMode"> & { gameMode?: QuizzMode }

export const getResultsMeta = (): GameResultMeta[] => {
  const resultsPath = getPath("results")

  if (!fs.existsSync(resultsPath)) {
    return []
  }

  const readMeta = (file: string): GameResultMeta | null => {
    const data = readJson(join(resultsPath, file)) as StoredResult | null

    if (!data) {
      return null
    }

    try {
      const sortedPlayers = data.players
        ? [...data.players].sort(
            (a, b) => (a.rank ?? 999) - (b.rank ?? 999) || (b.points ?? 0) - (a.points ?? 0),
          )
        : []
      const topPlayer = sortedPlayers[0]

      return {
        id: data.id,
        gameMode: data.gameMode ?? QUIZZ_MODES.QUIZ,
        subject: data.subject,
        date: data.date,
        playerCount: data.players.length,
        winnerName: topPlayer?.username,
        topScore: topPlayer?.points,
      }
    } catch {
      return null
    }
  }

  try {
    return listJsonFiles(resultsPath)
      .map(readMeta)
      .filter((meta): meta is GameResultMeta => meta !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch {
    return []
  }
}

export const getResultById = (id: string): GameResult => {
  const file = requireFileById("results", id, "errors:result.notFound")
  const data = readJson(join(getPath("results"), file))

  if (!data) {
    throw notFound("errors:result.notFound")
  }

  const result = data as unknown as StoredResult

  return { ...result, gameMode: result.gameMode ?? QUIZZ_MODES.QUIZ }
}

export const deleteResult = (id: string): void => {
  const file = requireFileById("results", id, "errors:result.notFound")

  fs.unlinkSync(join(getPath("results"), file))
}

export const getResults = (): GameResult[] => {
  const resultsPath = getPath("results")

  if (!fs.existsSync(resultsPath)) {
    return []
  }

  try {
    return listJsonFiles(resultsPath)
      .map((file) => {
        const data = readJson(join(resultsPath, file)) as StoredResult | null
        if (!data) return null
        return { ...data, gameMode: data.gameMode ?? QUIZZ_MODES.QUIZ } as GameResult
      })
      .filter((r): r is GameResult => r !== null)
  } catch {
    return []
  }
}

export interface BackupBundle {
  version: 1
  exportedAt: string
  quizz: QuizzWithId[]
  results: GameResult[]
}

export const exportBackup = (): BackupBundle => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  quizz: getQuizz(),
  results: getResults(),
})

export const restoreBackup = (bundle: BackupBundle): { quizzCount: number; resultCount: number } => {
  // Ensure directories exist
  initConfig()
  const resultsPath = getPath("results")
  if (!fs.existsSync(resultsPath)) {
    fs.mkdirSync(resultsPath)
  }

  let quizzCount = 0
  let resultCount = 0

  for (const quizz of bundle.quizz ?? []) {
    try {
      const { id, ...rest } = quizz
      const result = quizzValidator.safeParse(rest)
      if (!result.success) continue
      const fileName = normalizeFilename(result.data.subject, { fallback: "quizz" })
      const filePath = getPath(`quizz/${fileName}.json`)
      // Don't overwrite if same id already exists
      const existing = findFileById("quizz", id)
      if (!existing) {
        fs.writeFileSync(filePath, JSON.stringify({ id, ...result.data }, null, 2))
        quizzCount++
      }
    } catch {
      /* skip invalid */
    }
  }

  for (const result of bundle.results ?? []) {
    try {
      if (!result.id) continue
      const existing = findFileById("results", result.id)
      if (!existing) {
        fs.writeFileSync(
          join(resultsPath, `${result.id}.json`),
          JSON.stringify(result, null, 2),
        )
        resultCount++
      }
    } catch {
      /* skip invalid */
    }
  }

  return { quizzCount, resultCount }
}

export const saveQuizz = (data: unknown): { id: string } => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw invalidInput(result.error.issues[0].message)
  }

  const id = nanoid()
  const fileName = normalizeFilename(result.data.subject, { fallback: "quizz" })

  fs.writeFileSync(
    getPath(`quizz/${fileName}.json`),
    JSON.stringify({ id, ...result.data }, null, 2),
  )

  return { id }
}
