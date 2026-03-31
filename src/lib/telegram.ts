const TOKEN   = process.env.TELEGRAM_BOT_TOKEN!
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!

async function send(text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
  })
}

export async function notifyPickMade(player: string, team: string, predHome: number, predAway: number) {
  await send(`✅ <b>${player}</b> has picked <b>${team}</b> to win (${predHome}–${predAway})`)
}

export async function notifyNextPicker(player: string, gwNumber: number) {
  await send(`🟡 It's <b>${player}</b>'s turn to pick for Gameweek ${gwNumber}!`)
}

export async function notifySkipped(player: string, nextPlayer: string) {
  await send(`⚠️ <b>${player}</b> has no available teams this gameweek and has been skipped.\nIt's now <b>${nextPlayer}</b>'s turn to pick.`)
}

export async function notifyResultsSettled(gw: number, summary: { player: string; pts: number }[]) {
  const lines = summary.map(s => `  ${s.player}: ${s.pts} pts`).join("\n")
  await send(`📊 <b>Gameweek ${gw} results are in!</b>\n\n${lines}`)
}
