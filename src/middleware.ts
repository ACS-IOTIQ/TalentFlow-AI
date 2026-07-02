import { auth } from '@/lib/auth/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/api/auth']

const ROLE_PATHS: Record<string, string[]> = {
  '/users': ['SUPER_ADMIN', 'CSO'],
  '/revenue': ['SUPER_ADMIN', 'CSO', 'CMD'],
  '/jds/new': ['SUPER_ADMIN', 'CSO', 'DIR_TECH'],
}

export default auth((req) => {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (!req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = req.auth.user?.role
  for (const [path, allowedRoles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(path) && !allowedRoles.includes(role || '')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
}
