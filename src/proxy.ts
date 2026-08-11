import { type NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

// Runs on the Edge runtime — far lower cold-start than a Node serverless
// function. Handles the auth redirect that used to live in the dynamic root
// page, so opening the app bounces straight to the (static, cached) login page
// without spinning up a serverless render first.
// (Next 16 renamed the "middleware" convention to "proxy".)

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)
const COOKIE = "pl_session"
const PROTECTED = ["/pick", "/history", "/leaderboard", "/admin"]

async function isAuthed(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE)?.value
  if (!token) return false
  try {
    await jwtVerify(token, SECRET)
    return true
  } catch {
    return false
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const authed = await isAuthed(req)

  // Root: decide destination at the edge instead of in a dynamic server render.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(authed ? "/pick" : "/login", req.url))
  }

  // Already signed in but on the login page → straight into the app.
  if (pathname === "/login" && authed) {
    return NextResponse.redirect(new URL("/pick", req.url))
  }

  // Protected pages require a valid session.
  if (!authed && PROTECTED.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/pick",
    "/pick/:path*",
    "/history",
    "/history/:path*",
    "/leaderboard",
    "/leaderboard/:path*",
    "/admin",
    "/admin/:path*",
  ],
}
