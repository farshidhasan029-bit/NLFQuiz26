import { describe, expect, it } from "vitest"
import { parseQuestionsFromText } from "./document-parser"

describe("document-parser", () => {
  it("parses numbered questions with inline asterisk solutions", () => {
    const raw = `
1. What is the capital of France?
A. London
B. Berlin
C. Paris*
D. Madrid

2. Which planet is closest to the Sun?
A) Venus
B) Mercury
C) Mars
D) Jupiter
Answer: B
    `

    const quiz = parseQuestionsFromText(raw, "Geography Quiz.docx")
    expect(quiz.subject).toBe("Geography Quiz")
    expect(quiz.questions).toHaveLength(2)

    expect(quiz.questions[0].question).toBe("What is the capital of France?")
    expect(quiz.questions[0].answers).toEqual(["London", "Berlin", "Paris", "Madrid"])
    expect(quiz.questions[0].solutions).toEqual([2])

    expect(quiz.questions[1].question).toBe("Which planet is closest to the Sun?")
    expect(quiz.questions[1].answers).toEqual(["Venus", "Mercury", "Mars", "Jupiter"])
    expect(quiz.questions[1].solutions).toEqual([1])
  })

  it("parses questions with separate answer key section at the bottom", () => {
    const raw = `
Science Test

1. How many bones are in the adult human body?
A. 106
B. 206
C. 306
D. 406

2. What is the chemical symbol for Gold?
A. Ag
B. Fe
C. Au
D. Pb

Answer Key:
1. B
2. C
    `

    const quiz = parseQuestionsFromText(raw, "Science Test.pdf")
    expect(quiz.questions).toHaveLength(2)
    expect(quiz.questions[0].solutions).toEqual([1])
    expect(quiz.questions[1].solutions).toEqual([2])
  })
})
