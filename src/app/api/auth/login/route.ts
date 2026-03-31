import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { supabaseAdmin } from "@/lib/supabase"
import { createSession } from "@/lib/auth"

export async function POST(req: Request) {
  const { name, pin } = await req.json()

  if (!name || !pin) {
    return NextResponse.json({ error: "Missing name or PIN" }, { status: 400 })
  }

  const { data: player, error } = await supabaseAdmin
    .from("players")
    .select("id, name, pin_hash")
    .eq("name", name)
    .single()

  if (error || !player) {
    return NextResponse.json({ error: "Player not found" }, { status: 401 })
  }

  const valid = await bcrypt.compare(pin, player.pin_hash)
  if (!valid) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 })
  }

  await createSession({ playerId: player.id, playerName: player.name })
  return NextResponse.json({ name: player.name })
}
