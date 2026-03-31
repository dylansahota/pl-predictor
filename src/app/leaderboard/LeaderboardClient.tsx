"use client"
import { useEffect, useRef } from "react"
import Nav from "@/components/Nav"

const PLAYERS = ["Damien", "Tunde", "Gowth", "Dyl"]
const PLAYER_COLORS: Record<string, string> = {
  Damien: "#4ade80",
  Tunde:  "#60a5fa",
  Gowth:  "#f472b6",
  Dyl:    "#fbbf24",
}

interface Pick { player_id: string; points_awarded: number; team_picked: string; players: any; gameweeks: any }

function TrendChart({ allPicks }: { allPicks: Pick[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    // Build cumulative points per GW per player
    const gwNums = [...new Set(allPicks.map(p => p.gameweeks?.gw_number).filter(Boolean))].sort((a, b) => a - b) as number[]
    if (gwNums.length === 0) return

    const series: Record<string, number[]> = {}
    PLAYERS.forEach(name => {
      let cum = 0
      series[name] = gwNums.map(gw => {
        const pick = allPicks.find(p => p.players?.name === name && p.gameweeks?.gw_number === gw)
        cum += pick?.points_awarded ?? 0
        return cum
      })
    })

    const maxPts = Math.max(...Object.values(series).flat())
    const pad = { top: 16, right: 16, bottom: 32, left: 36 }
    const cw = w - pad.left - pad.right
    const ch = h - pad.top - pad.bottom

    // Grid lines
    const steps = 4
    for (let i = 0; i <= steps; i++) {
      const y = pad.top + ch - (i / steps) * ch
      const val = Math.round((i / steps) * maxPts)
      ctx.strokeStyle = "#1e2230"
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke()
      ctx.fillStyle = "#444c5e"
      ctx.font = "10px -apple-system, sans-serif"
      ctx.textAlign = "right"
      ctx.fillText(String(val), pad.left - 6, y + 3)
    }

    // X axis labels
    const labelEvery = gwNums.length > 20 ? 5 : gwNums.length > 10 ? 3 : 1
    gwNums.forEach((gw, i) => {
      if (i % labelEvery !== 0 && i !== gwNums.length - 1) return
      const x = pad.left + (i / (gwNums.length - 1)) * cw
      ctx.fillStyle = "#444c5e"
      ctx.font = "10px -apple-system, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(`${gw}`, x, h - pad.bottom + 14)
    })

    // X axis label header
    ctx.fillStyle = "#333"
    ctx.font = "10px -apple-system, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("gameweek", pad.left + cw / 2, h - 4)

    // Draw lines
    PLAYERS.forEach(name => {
      const pts = series[name]
      const color = PLAYER_COLORS[name]
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineJoin = "round"
      ctx.beginPath()
      pts.forEach((p, i) => {
        const x = pad.left + (i / (gwNums.length - 1)) * cw
        const y = pad.top + ch - (p / maxPts) * ch
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()

      // Final dot
      const lastX = pad.left + ((pts.length - 1) / (gwNums.length - 1)) * cw
      const lastY = pad.top + ch - (pts[pts.length - 1] / maxPts) * ch
      ctx.fillStyle = color
      ctx.beginPath(); ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2); ctx.fill()
    })
  }, [allPicks])

  return (
    <div style={{ background: "#181c24", border: "1px solid #252a35", borderRadius: 12, padding: "16px 12px 12px", marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: "#555", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Points trend</div>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        {PLAYERS.map(name => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 99, background: PLAYER_COLORS[name] }} />
            <span style={{ fontSize: 12, color: "#888" }}>{name}</span>
          </div>
        ))}
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", height: 180, display: "block" }} />
    </div>
  )
}

export default function LeaderboardClient({ allPicks, currentGW, currentGWPicks, picksForTeamsUsed, session }: {
  allPicks: Pick[]
  currentGW: { id: string; gw_number: number } | null
  currentGWPicks: any[]
  picksForTeamsUsed: any[]
  session: { playerName: string }
}) {
  const leaderboard = PLAYERS.map(name => {
    const picks = allPicks.filter(p => p.players?.name === name)
    const total = picks.reduce((s, p) => s + (p.points_awarded ?? 0), 0)
    return { name, total, picks: picks.length, avg: picks.length > 0 ? (total / picks.length).toFixed(1) : "0.0" }
  }).sort((a, b) => b.total - a.total)

  const teamsUsed = (player: string) =>
    [...new Set(picksForTeamsUsed.filter(p => p.players?.name === player).map(p => p.team_picked))]

  const c = {
    page:  { minHeight: "100svh", background: "#0f1117", paddingBottom: 90 },
    inner: { maxWidth: 480, margin: "0 auto", padding: "24px 16px 0" },
    grid:  { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 20 },
    metricCard: (i: number, name: string) => ({
      background: "#181c24", border: `1px solid ${i === 0 ? PLAYER_COLORS[name] : "#252a35"}`,
      borderRadius: 12, padding: "14px",
      gridColumn: i === 0 ? "1 / -1" as const : "auto",
    }),
    pos:   { fontSize: 11, color: "#555", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 4 },
    name:  (i: number, name: string) => ({ fontSize: i === 0 ? 18 : 15, fontWeight: 700, color: i === 0 ? PLAYER_COLORS[name] : "#ddd", marginBottom: 6 }),
    pts:   (i: number) => ({ fontSize: i === 0 ? 36 : 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }),
    stat:  { fontSize: 12, color: "#555" },
    sectionLabel: { fontSize: 11, color: "#555", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "20px 0 10px" },
    gwRow: { background: "#181c24", border: "1px solid #252a35", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" },
    teamCard: { background: "#181c24", border: "1px solid #252a35", borderRadius: 12, padding: "12px 14px", marginBottom: 8 },
    teamTag: { display: "inline-block", fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#0f1117", color: "#555", border: "1px solid #252a35", margin: "2px 3px 2px 0" },
  }

  return (
    <div style={c.page}>
      <div style={c.inner}>

        <div style={c.grid}>
          {leaderboard.map((p, i) => (
            <div key={p.name} style={c.metricCard(i, p.name)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={c.pos}>{["1st","2nd","3rd","4th"][i]}</div>
                  <div style={c.name(i, p.name)}>{p.name}</div>
                  <div style={c.pts(i)}>{p.total}<span style={{ fontSize: 14, color: "#555", fontWeight: 400, marginLeft: 4 }}>pts</span></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={c.stat}>{p.picks} picks</div>
                  <div style={c.stat}>{p.avg} avg</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <TrendChart allPicks={allPicks} />

        {currentGW && (
          <>
            <div style={c.sectionLabel}>GW{currentGW.gw_number} picks so far</div>
            {currentGWPicks.length === 0
              ? <p style={{ fontSize: 13, color: "#333" }}>No picks yet.</p>
              : currentGWPicks.map((p, i) => (
                <div key={i} style={c.gwRow}>
                  <span style={{ fontSize: 13, color: "#666" }}>{p.players?.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#ddd" }}>{p.pred_winner} to win · {p.pred_home}–{p.pred_away}</span>
                </div>
              ))
            }
          </>
        )}

        <div style={c.sectionLabel}>Teams used (GW20+)</div>
        {PLAYERS.map(name => {
          const used = teamsUsed(name)
          return (
            <div key={name} style={c.teamCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#ddd" }}>{name}</span>
                <span style={{ fontSize: 11, color: "#555" }}>{20 - used.length} of 20 left</span>
              </div>
              <div>
                {used.map(t => <span key={t} style={c.teamTag}>{t}</span>)}
                {used.length === 0 && <span style={{ fontSize: 12, color: "#333" }}>None yet</span>}
              </div>
            </div>
          )
        })}
      </div>
      <Nav active="leaderboard" />
    </div>
  )
}
