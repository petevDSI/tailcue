'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Shield, Heart } from 'lucide-react'

const TABS = [
  { label: 'Home',        href: '/',          icon: Home,   match: (p: string) => p === '/'               },
  { label: 'Price Check', href: '/checker',   icon: Search, match: (p: string) => p.startsWith('/checker') },
  { label: 'Insurance',   href: '/insurance', icon: Shield, match: (p: string) => p.startsWith('/insurance') },
  { label: 'Care',        href: '/care',      icon: Heart,  match: (p: string) => p.startsWith('/care')   },
] as const

export default function BottomTabBar() {
  const pathname = usePathname()

  if (pathname.startsWith('/blog') || pathname.startsWith('/admin')) return null

  return (
    <>
      {/* Spacer so page content doesn't hide behind the fixed bar */}
      <div className="h-20 sm:hidden" aria-hidden="true" />

      {/* Fixed bottom bar — mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white border-t border-stone-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-4 h-16">
          {TABS.map(({ label, href, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 transition-colors
                  ${active ? 'text-amber-500' : 'text-stone-400 hover:text-stone-600'}`}
              >
                <Icon
                  className={`w-6 h-6 transition-all ${active ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`}
                />
                <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-amber-600' : 'text-stone-400'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
