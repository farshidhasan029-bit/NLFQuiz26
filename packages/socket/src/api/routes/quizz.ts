import { zValidator } from "@hono/zod-validator"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import {
  deleteQuizz,
  getQuizzById,
  getQuizzMeta,
  saveQuizz,
  updateQuizz,
} from "@razzia/socket/services/config"
import {
  extractTextFromBuffer,
  parseQuestionsFromText,
} from "@razzia/socket/services/document-parser"
import { StatusCodes } from "http-status-codes"

const routes = apiFactory
  .createApp()
  .use(requireManager)
  .get("/", (c) => c.json({ quizz: getQuizzMeta() }))
  .post("/import-document", async (c) => {
    const body = await c.req.parseBody()
    const file = body["file"]
    if (!file || typeof file === "string") {
      return c.json(
        { error: "errors:quizz.missingDocumentFile" },
        StatusCodes.BAD_REQUEST,
      )
    }

    try {
      const buffer = Buffer.from(await (file as File).arrayBuffer())
      const text = await extractTextFromBuffer(
        buffer,
        (file as File).type || "",
        (file as File).name || "document",
      )
      const parsedQuizz = parseQuestionsFromText(
        text,
        (file as File).name || "Imported Quiz",
      )

      if (!parsedQuizz.questions || parsedQuizz.questions.length === 0) {
        return c.json(
          { error: "errors:quizz.noQuestionsExtracted" },
          StatusCodes.BAD_REQUEST,
        )
      }

      const saved = saveQuizz(parsedQuizz)

      return c.json(
        {
          id: saved.id,
          quizz: parsedQuizz,
          totalQuestions: parsedQuizz.questions.length,
        },
        StatusCodes.CREATED,
      )
    } catch (err: any) {
      console.error("Document import error:", err)
      return c.json(
        { error: "errors:quizz.failedToParseDocument" },
        StatusCodes.BAD_REQUEST,
      )
    }
  })
  .get("/:id", (c) => c.json(getQuizzById(c.req.param("id"))))
  .post("/", zValidator("json", quizzValidator, i18nHook), (c) =>
    c.json(saveQuizz(c.req.valid("json")), StatusCodes.CREATED),
  )
  .patch("/:id", zValidator("json", quizzValidator, i18nHook), (c) =>
    c.json(updateQuizz(c.req.param("id"), c.req.valid("json"))),
  )
  .delete("/:id", (c) => {
    deleteQuizz(c.req.param("id"))

    return c.body(null, StatusCodes.NO_CONTENT)
  })

export const quizz = routes
