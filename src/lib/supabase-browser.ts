import { createBrowserClient } from '@supabase/ssr'

let instance: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowser() {
  if (!instance) {
    instance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return document.cookie
              .split('; ')
              .filter(Boolean)
              .map((c) => {
                const [name, ...rest] = c.split('=')
                return { name, value: rest.join('=') }
              })
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              let cookie = `${name}=${value}`
              if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
              if (options?.path) cookie += `; path=${options.path}`
              else cookie += '; path=/'
              if (options?.domain) cookie += `; domain=${options.domain}`
              if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
              if (options?.secure) cookie += '; secure'
              document.cookie = cookie
            })
          },
        },
      }
    )
  }
  return instance
}
