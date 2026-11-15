import type { GameResult, QuestionResult } from "@razzia/common/types/game"
import { isAnswerCorrect } from "@razzia/web/features/questions/utils"
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"

export type ResultViewMode = "overall" | "questions"

export interface PlayerOverallResult {
  username: string
  rank: number
  points: number
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  totalQuestions: number
  accuracyPct: number
  isWinner: boolean
}

export interface QuizOverallStats {
  winner: PlayerOverallResult | null
  topThree: PlayerOverallResult[]
  totalPlayers: number
  totalQuestions: number
  highestScore: number
  averageScore: number
  overallAccuracy: number
}

interface ResultModalContextType {
  result: GameResult
  questionResult: QuestionResult
  questionIndex: number
  total: number
  totalPlayers: number
  answeredCount: number
  correctCount: number
  correctPct: number
  maxAnswerCount: number
  getPlayerPoints: (_name: string) => number
  goNext: () => void
  goPrev: () => void
  onClose: () => void
  viewMode: ResultViewMode
  setViewMode: (_mode: ResultViewMode) => void
  overallPlayers: PlayerOverallResult[]
  overallStats: QuizOverallStats
}

const ResultModalContext = createContext<ResultModalContextType | null>(null)

type Props = PropsWithChildren<{
  result: GameResult
  onClose: () => void
}>

export const ResultModalProvider = ({ children, result, onClose }: Props) => {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [viewMode, setViewMode] = useState<ResultViewMode>("overall")

  const questionResult = result.questions[questionIndex]
  const total = result.questions.length
  const totalPlayers = result.players.length

  const answeredCount = questionResult?.playerAnswers
    ? questionResult.playerAnswers.filter(
        (pa) => pa.answerIds !== null && pa.answerIds.length > 0,
      ).length
    : 0

  const correctCount = questionResult?.playerAnswers
    ? questionResult.playerAnswers.filter(
        (pa) => pa.correct ?? isAnswerCorrect(questionResult, pa.answerIds),
      ).length
    : 0

  const correctPct =
    totalPlayers > 0 ? Math.round((correctCount / totalPlayers) * 100) : 0

  const maxAnswerCount = Math.max(
    1,
    ...(questionResult?.answers ?? []).map(
      (_, ai) =>
        questionResult.playerAnswers.filter((pa) => pa.answerIds?.includes(ai))
          .length,
    ),
  )

  const getPlayerPoints = (name: string) =>
    result.players.find((p) => p.username === name)?.points ?? 0

  const goNext = () => setQuestionIndex((i) => Math.min(i + 1, total - 1))
  const goPrev = () => setQuestionIndex((i) => Math.max(i - 1, 0))

  const overallPlayers: PlayerOverallResult[] = useMemo(() => {
    const sorted = [...(result.players ?? [])].sort((a, b) => {
      const rankA = a.rank ?? 9999
      const rankB = b.rank ?? 9999
      if (rankA !== rankB) return rankA - rankB
      return (b.points ?? 0) - (a.points ?? 0)
    })

    return sorted.map((p, idx) => {
      const rank = p.rank ?? idx + 1
      let correct = 0
      let incorrect = 0
      let unanswered = 0

      for (const q of result.questions ?? []) {
        const pa = q.playerAnswers?.find((a) => a.playerName === p.username)
        if (!pa || pa.answerIds === null || pa.answerIds.length === 0) {
          unanswered++
        } else {
          const isRight = pa.correct ?? isAnswerCorrect(q, pa.answerIds)
          if (isRight) {
            correct++
          } else {
            incorrect++
          }
        }
      }

      const totalQ = result.questions.length
      const accuracy = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0

      return {
        username: p.username,
        rank,
        points: p.points ?? 0,
        correctCount: correct,
        incorrectCount: incorrect,
        unansweredCount: unanswered,
        totalQuestions: totalQ,
        accuracyPct: accuracy,
        isWinner: rank === 1,
      }
    })
  }, [result])

  const overallStats: QuizOverallStats = useMemo(() => {
    const winner = overallPlayers.length > 0 ? overallPlayers[0] : null
    const topThree = overallPlayers.slice(0, 3)
    const highestScore = winner ? winner.points : 0
    const totalPoints = overallPlayers.reduce((acc, p) => acc + p.points, 0)
    const averageScore =
      overallPlayers.length > 0
        ? Math.round(totalPoints / overallPlayers.length)
        : 0

    const totalQuestions = result.questions.length
    const totalPossibleAnswers = overallPlayers.length * totalQuestions
    const totalCorrectAnswers = overallPlayers.reduce(
      (acc, p) => acc + p.correctCount,
      0,
    )
    const overallAccuracy =
      totalPossibleAnswers > 0
        ? Math.round((totalCorrectAnswers / totalPossibleAnswers) * 100)
        : 0

    return {
      winner,
      topThree,
      totalPlayers: overallPlayers.length,
      totalQuestions,
      highestScore,
      averageScore,
      overallAccuracy,
    }
  }, [overallPlayers, result.questions.length])

  return (
    <ResultModalContext.Provider
      value={{
        result,
        questionResult,
        questionIndex,
        total,
        totalPlayers,
        answeredCount,
        correctCount,
        correctPct,
        maxAnswerCount,
        getPlayerPoints,
        goNext,
        goPrev,
        onClose,
        viewMode,
        setViewMode,
        overallPlayers,
        overallStats,
      }}
    >
      {children}
    </ResultModalContext.Provider>
  )
}

export const useResultModal = () => {
  const ctx = useContext(ResultModalContext)

  if (!ctx) {
    throw new Error("useResultModal must be used inside ResultModalProvider")
  }

  return ctx
}
