import { useResultModal } from "@razzia/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { Award, Check, HelpCircle, Trophy, X } from "lucide-react"
import { useTranslation } from "react-i18next"

const ResultModalOverall = () => {
  const { overallPlayers, overallStats } = useResultModal()
  const { t } = useTranslation()

  const winner = overallStats.winner
  const runnerUp = overallStats.topThree[1]
  const thirdPlace = overallStats.topThree[2]

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Winner Spotlight Card */}
      {winner ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-yellow-600/5 p-4 shadow-lg sm:p-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            <div className="relative flex size-20 shrink-0 items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-400/20 shadow-inner sm:size-24">
              <Trophy className="size-10 text-amber-500 drop-shadow sm:size-12" />
              <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-black shadow">
                #1
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <Award className="size-3.5" />
                  {t("manager:result.winner")}
                </span>
                <span className="text-muted-foreground text-xs">
                  {winner.accuracyPct}% {t("manager:result.accuracy")}
                </span>
              </div>

              <h3 className="text-foreground mt-1 truncate text-2xl font-black sm:text-3xl">
                {winner.username}
              </h3>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <span className="rounded-lg bg-amber-500/20 px-3 py-1 text-base font-extrabold text-amber-700 dark:text-amber-300">
                  {winner.points.toLocaleString()} pts
                </span>
                <span className="text-muted-foreground text-sm font-medium">
                  {winner.correctCount} / {winner.totalQuestions}{" "}
                  {t("manager:result.table.correct")}
                </span>
              </div>
            </div>

            {/* Runner-ups preview on desktop */}
            {(runnerUp || thirdPlace) && (
              <div className="hidden shrink-0 flex-col gap-1.5 border-l border-amber-400/30 pl-4 text-xs sm:flex">
                {runnerUp && (
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-slate-300 font-bold text-black dark:bg-slate-400">
                      2
                    </span>
                    <span className="text-foreground max-w-28 truncate font-medium">
                      {runnerUp.username}
                    </span>
                    <span className="text-muted-foreground font-semibold">
                      {runnerUp.points} pts
                    </span>
                  </div>
                )}
                {thirdPlace && (
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-amber-700 font-bold text-white">
                      3
                    </span>
                    <span className="text-foreground max-w-28 truncate font-medium">
                      {thirdPlace.username}
                    </span>
                    <span className="text-muted-foreground font-semibold">
                      {thirdPlace.points} pts
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            {t("manager:result.none")}
          </p>
        </div>
      )}

      {/* Overview Metrics Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="bg-muted/50 rounded-xl border p-3 text-center">
          <span className="text-muted-foreground block text-xs font-medium">
            {t("manager:tabs.quizz")}
          </span>
          <span className="text-foreground text-lg font-bold">
            {overallStats.totalQuestions}
          </span>
        </div>
        <div className="bg-muted/50 rounded-xl border p-3 text-center">
          <span className="text-muted-foreground block text-xs font-medium">
            {t("manager:result.stats.playersAnswered")}
          </span>
          <span className="text-foreground text-lg font-bold">
            {overallStats.totalPlayers}
          </span>
        </div>
        <div className="bg-muted/50 rounded-xl border p-3 text-center">
          <span className="text-muted-foreground block text-xs font-medium">
            {t("manager:result.highestScore")}
          </span>
          <span className="text-foreground text-lg font-bold text-amber-600 dark:text-amber-400">
            {overallStats.highestScore.toLocaleString()}
          </span>
        </div>
        <div className="bg-muted/50 rounded-xl border p-3 text-center">
          <span className="text-muted-foreground block text-xs font-medium">
            {t("manager:result.averageScore")}
          </span>
          <span className="text-foreground text-lg font-bold">
            {overallStats.averageScore.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Participants Scorecard Standings Table */}
      <div className="overflow-hidden rounded-xl border">
        <div className="bg-muted/80 border-b px-4 py-2.5">
          <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
            {t("manager:result.overallEvaluation")} — {overallPlayers.length}{" "}
            {t("manager:result.table.player")}
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase">
                <th className="px-4 py-2.5 text-center w-16">
                  {t("manager:result.position")}
                </th>
                <th className="px-4 py-2.5">
                  {t("manager:result.table.player")}
                </th>
                <th className="px-4 py-2.5 text-right">
                  {t("manager:result.marks")}
                </th>
                <th className="px-4 py-2.5 text-center">
                  {t("manager:result.accuracy")}
                </th>
                <th className="px-4 py-2.5 text-right">
                  {t("manager:result.questionBreakdown")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {overallPlayers.map((player) => {
                const isFirst = player.rank === 1
                const isSecond = player.rank === 2
                const isThird = player.rank === 3

                return (
                  <tr
                    key={player.username}
                    className={clsx(
                      "transition-colors",
                      isFirst
                        ? "bg-amber-500/10 hover:bg-amber-500/15 font-semibold"
                        : "hover:bg-muted/30",
                    )}
                  >
                    {/* Rank Badge */}
                    <td className="px-4 py-3 text-center">
                      {isFirst ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-black shadow-sm">
                          🥇 #1
                        </span>
                      ) : isSecond ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-300 dark:bg-slate-500 px-2 py-0.5 text-xs font-bold text-black dark:text-white">
                          🥈 #2
                        </span>
                      ) : isThird ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-700 px-2 py-0.5 text-xs font-bold text-white">
                          🥉 #3
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs font-semibold">
                          #{player.rank}
                        </span>
                      )}
                    </td>

                    {/* Participant Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground truncate font-medium">
                          {player.username}
                        </span>
                        {isFirst && (
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            {t("manager:result.winner")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Marks / Score */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={clsx(
                          "font-mono font-bold",
                          isFirst
                            ? "text-amber-600 dark:text-amber-400 text-base"
                            : "text-foreground",
                        )}
                      >
                        {player.points.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground ml-1 text-xs">
                        pts
                      </span>
                    </td>

                    {/* Accuracy Percentage */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-foreground text-xs font-bold">
                          {player.accuracyPct}%
                        </span>
                        <div className="bg-muted mt-1 h-1.5 w-16 overflow-hidden rounded-full">
                          <div
                            className={clsx(
                              "h-full rounded-full transition-all",
                              player.accuracyPct >= 80
                                ? "bg-emerald-500"
                                : player.accuracyPct >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500",
                            )}
                            style={{ width: `${player.accuracyPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Breakdown Chips */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5 text-xs">
                        <span
                          className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400"
                          title={t("manager:result.table.correct")}
                        >
                          <Check className="size-3 stroke-3" />
                          {player.correctCount}
                        </span>
                        {player.incorrectCount > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded bg-red-500/10 px-1.5 py-0.5 font-semibold text-red-600 dark:text-red-400"
                            title={t("manager:result.table.incorrect")}
                          >
                            <X className="size-3 stroke-3" />
                            {player.incorrectCount}
                          </span>
                        )}
                        {player.unansweredCount > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground"
                            title={t("manager:result.noAnswer")}
                          >
                            <HelpCircle className="size-3" />
                            {player.unansweredCount}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {overallPlayers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted-foreground p-8 text-center text-sm"
                  >
                    {t("manager:result.none")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ResultModalOverall
