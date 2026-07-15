import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath } from './lib/supabase/middleware'
import { SESSION_MAX_AGE_SECONDS } from './lib/supabase/session-config'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (isPublicPath(request.nextUrl.pathname)) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: SESSION_MAX_AGE_SECONDS },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() só decodifica o cookie localmente (sem chamar o Supabase),
  // trocando um pouco de rigor (getUser() revalida o token no servidor a
  // cada request) por navegação bem mais rápida — aceitável aqui porque o
  // app é de uso pessoal.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
