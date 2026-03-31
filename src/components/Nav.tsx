"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"

const LINKS = [
  { href: "/pick",        label: "Pick" },
  { href: "/history",     label: "History" },
  { href: "/leaderboard", label: "Leaderboard" },
]

export default function Nav({ active }: { active: string }) {
  const router = useRouter()

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "#0d1016",
      borderTop: "1px solid #1e2230",
      display: "flex",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {LINKS.map(l => {
        const isActive = active === l.href.slice(1)
        return (
          <Link key={l.href} href={l.href} style={{
            flex: 1, padding: "14px 0", textAlign: "center",
            fontSize: 13, fontWeight: isActive ? 600 : 400,
            color: isActive ? "#4ade80" : "#444c5e",
            textDecoration: "none", letterSpacing: isActive ? "0.01em" : 0,
          }}>
            {l.label}
          </Link>
        )
      })}
      <button onClick={handleSignOut} style={{
        padding: "14px 16px", fontSize: 12, color: "#333",
        border: "none", background: "none", cursor: "pointer",
      }}>
        Out
      </button>
    </nav>
  )
}
