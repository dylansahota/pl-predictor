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
    <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white">
      <div className="max-w-lg mx-auto flex">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href}
            className={`flex-1 py-3 text-center text-sm transition-colors ${active === l.href.slice(1) ? "font-medium text-black" : "text-gray-400"}`}>
            {l.label}
          </Link>
        ))}
        <button onClick={handleSignOut}
          className="px-4 py-3 text-xs text-gray-300 hover:text-gray-500 transition-colors">
          Out
        </button>
      </div>
    </nav>
  )
}
