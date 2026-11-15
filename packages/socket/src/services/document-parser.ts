import { QUESTION_TYPES, QUIZZ_MODES } from "@razzia/common/constants"
import type { QuizzValidated } from "@razzia/common/validators/quizz"

export const extractTextFromBuffer = async (
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<string> => {
  const lowerName = filename.toLowerCase()

  // 1. PDF Documents
  if (lowerName.endsWith(".pdf") || mimetype.includes("pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: buffer })
      const textResult = await parser.getText()
      await parser.destroy()
      return textResult.text || ""
    } catch (err) {
      console.error("PDF parse error:", err)
      throw new Error("Failed to parse PDF document")
    }
  }

  // 2. Word Documents (.docx, .doc)
  if (
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc") ||
    mimetype.includes("word") ||
    mimetype.includes("officedocument")
  ) {
    try {
      const mammoth = await import("mammoth")
      const result = await mammoth.extractRawText({ buffer })
      return result.value || ""
    } catch (err) {
      console.error("DOCX parse error:", err)
      throw new Error("Failed to parse Word document")
    }
  }

  // 3. Plain Text / Markdown / CSV / RTF
  return buffer.toString("utf-8")
}

export const parseQuestionsFromText = (
  rawText: string,
  fallbackTitle = "Imported Quiz",
): QuizzValidated => {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // Extract subject title from fallback or first header line
  let subject = fallbackTitle.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
  if (
    lines.length > 0 &&
    !lines[0].match(/^(?:Q\d+|\d+)[.:)]/i) &&
    lines[0].length < 80
  ) {
    subject = lines[0].replace(/^(?:Quiz|Exam|Test|Assessment):\s*/i, "").trim()
  }

  // Extract any global answer key at bottom (e.g. "Answer Key: 1. A, 2. B")
  const bottomKeyMap = extractBottomAnswerKeys(rawText)

  const questions: QuizzValidated["questions"] = []
  const questionRegex =
    /^(?:(?:Question|Q|Вопрос|Pregunta|Frage|প্রশ্ন)\s*[-.:#]?\s*\d+|\d+)\s*[-.):#]\s*(.+)$/i
  const optionRegex =
    /^[*✓]?\s*(?:[([{]?[A-Ha-h][)\]}:.-]|\([A-Ha-h]\))\s*(.+)$/
  const answerLineRegex =
    /^(?:Correct\s*)?Ans(?:wer)?\s*[:=-]\s*([A-Ha-h]|\d+|.+)$/i

  let currentQ: {
    question: string
    answers: string[]
    solutionLetter: string | null
    solutions: number[]
  } | null = null

  let qIndexCounter = 0

  for (const line of lines) {
    // Check if line starts with an answer key section (stop question parsing)
    if (/^(?:Answer\s*Key|Solutions?|Answers)\s*:\s*$/i.test(line)) {
      if (currentQ && currentQ.answers.length >= 2) {
        questions.push(finalizeQuestion(currentQ, qIndexCounter, bottomKeyMap))
        currentQ = null
      }
      break
    }

    const qMatch = line.match(questionRegex)
    const ansLineMatch = line.match(answerLineRegex)

    if (qMatch && !line.match(optionRegex)) {
      if (currentQ && currentQ.answers.length >= 2) {
        questions.push(finalizeQuestion(currentQ, qIndexCounter, bottomKeyMap))
        qIndexCounter++
      }
      currentQ = {
        question: qMatch[1].trim(),
        answers: [],
        solutionLetter: null,
        solutions: [],
      };
      continue
    }

    if (currentQ) {
      if (ansLineMatch) {
        currentQ.solutionLetter = ansLineMatch[1].trim()
        continue
      }

      // Check inline options like "A) Paris  B) London"
      const inlineMatches = splitInlineOptions(line)
      if (inlineMatches.length >= 2) {
        for (const opt of inlineMatches) {
          addOption(currentQ, opt)
        }
        continue
      }

      // Single option line
      if (optionRegex.test(line)) {
        addOption(currentQ, line)
        continue
      }

      // Question continuation before answers
      if (currentQ.answers.length === 0) {
        currentQ.question += " " + line
      }
    }
  }

  if (currentQ && currentQ.answers.length >= 2) {
    questions.push(finalizeQuestion(currentQ, qIndexCounter, bottomKeyMap))
  }

  return {
    gameMode: QUIZZ_MODES.QUIZ,
    subject: subject || "Imported Quiz",
    questions,
  }
}

function addOption(
  currentQ: {
    question: string
    answers: string[]
    solutionLetter: string | null
    solutions: number[]
  },
  rawLine: string,
) {
  let isCorrect = false
  let trimmed = rawLine.trim()
  if (trimmed.startsWith("*") || trimmed.startsWith("✓")) {
    isCorrect = true
    trimmed = trimmed.replace(/^[*✓]\s*/, "")
  }

  let text = trimmed.replace(/^[([{]?[A-Ha-h][)\]}:.-]\s*/, "").trim()

  if (
    text.includes("*") ||
    /\(correct\)/i.test(text) ||
    /\[correct\]/i.test(text) ||
    /✓/.test(text)
  ) {
    isCorrect = true
    text = text
      .replace(/[*✓]/g, "")
      .replace(/\((?:correct|answer)\)/gi, "")
      .replace(/\[(?:correct|answer)\]/gi, "")
      .trim()
  }

  const optionIndex = currentQ.answers.length
  currentQ.answers.push(text)
  if (isCorrect) {
    currentQ.solutions.push(optionIndex)
  }
}

function splitInlineOptions(line: string): string[] {
  const parts: string[] = []
  const re = /(?:^|\s+)([A-Ha-h][).:-]\s*[^A-Ha-h).:-]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(line)) !== null) {
    parts.push(match[1].trim())
  }
  return parts
}

function extractBottomAnswerKeys(text: string): Map<number, number> {
  const keys = new Map<number, number>()
  const keySectionMatch = text.match(
    /(?:Answer\s*Key|Solutions?|Answers)\s*:\s*([\s\S]+)$/i,
  )
  if (keySectionMatch) {
    const lines = keySectionMatch[1].split(/\r?\n/)
    for (const line of lines) {
      const match = line.match(/(?:Q\s*)?(\d+)[.:)\s]+([A-Ha-h])/i)
      if (match) {
        const qNum = parseInt(match[1], 10)
        const letter = match[2].toUpperCase().charCodeAt(0) - 65
        keys.set(qNum, letter)
      }
    }
  }
  return keys
}

function finalizeQuestion(
  q: {
    question: string
    answers: string[]
    solutionLetter: string | null
    solutions: number[]
  },
  qIndex: number,
  bottomKeyMap: Map<number, number>,
): QuizzValidated["questions"][number] {
  // If solution letter was parsed on a line (e.g. Answer: B)
  if (q.solutions.length === 0 && q.solutionLetter) {
    const letter = q.solutionLetter.toUpperCase().charAt(0)
    const letterIdx = letter.charCodeAt(0) - 65
    if (letterIdx >= 0 && letterIdx < q.answers.length) {
      q.solutions.push(letterIdx)
    } else {
      const textIdx = q.answers.findIndex(
        (a) => a.toLowerCase() === q.solutionLetter?.toLowerCase(),
      )
      if (textIdx !== -1) {
        q.solutions.push(textIdx)
      }
    }
  }

  // Check bottom answer key (1-based index)
  if (q.solutions.length === 0) {
    const keyAnswerIdx = bottomKeyMap.get(qIndex + 1)
    if (
      keyAnswerIdx !== undefined &&
      keyAnswerIdx >= 0 &&
      keyAnswerIdx < q.answers.length
    ) {
      q.solutions.push(keyAnswerIdx)
    }
  }

  // Fallback to first option if no solution specified
  if (q.solutions.length === 0) {
    q.solutions.push(0)
  }

  return {
    type: QUESTION_TYPES.SINGLE,
    question: q.question,
    answers: q.answers,
    solutions: q.solutions,
    cooldown: 5,
    time: 20,
    maxPoints: 1000,
  }
}
