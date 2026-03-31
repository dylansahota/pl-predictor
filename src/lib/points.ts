export function calcPoints({
  predWinner,
  predHome,
  predAway,
  actualHome,
  actualAway,
  homeTeam,
  awayTeam,
}: {
  predWinner: string
  predHome: number
  predAway: number
  actualHome: number
  actualAway: number
  homeTeam: string
  awayTeam: string
}): number {
  const actualWinner =
    actualHome > actualAway ? homeTeam :
    actualAway > actualHome ? awayTeam :
    null // draw — no winner

  const winnerCorrect = actualWinner !== null && predWinner === actualWinner
  const scoreCorrect  = predHome === actualHome && predAway === actualAway

  return (winnerCorrect ? 1 : 0) + (scoreCorrect ? 1 : 0)
}
