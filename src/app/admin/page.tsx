import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import AdminClient from "./AdminClient"

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.playerName !== "Dyl") redirect("/pick")

  // All gameweeks that have fixtures, so Dyl can sync any of them
  const { data: gameweeks } = await supabaseAdmin
    .from("gameweeks")
    .select("gw_number, status")
    .order("gw_number", { ascending: false })

  const openGw = (gameweeks ?? []).find(g => g.status === "open")?.gw_number ?? null

  return (
    <AdminClient
      session={session}
      gameweeks={gameweeks ?? []}
      openGw={openGw}
    />
  )
}
