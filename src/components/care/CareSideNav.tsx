'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Pill, BarChart3, ClipboardList } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: (id: string) => `/care/${id}` },
  { label: 'Medications', icon: Pill,             path: (id: string) => `/care/${id}/medications` },
  { label: 'Insights',    icon: BarChart3,        path: (id: string) => `/care/${id}/insights` },
  { label: 'History',     icon: ClipboardList,    path: (id: string) => `/care/${id}/history` },
]

export function CareSideNav({ petId }: { petId: string }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === `/care/${petId}`) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed top-0 left-0 bottom-0 w-[220px] bg-card border-r border-border flex-col pt-6 z-30">
        <p className="px-5 text-[10px] font-semibold text-warm-muted uppercase tracking-widest mb-2">
          Care
        </p>
        <ul className="space-y-0.5 px-3">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const href = path(petId)
            const active = isActive(href)
            return (
              <li key={label}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-secondary text-primary'
                      : 'text-warm-muted hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-30">
        <ul className="flex">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const href = path(petId)
            const active = isActive(href)
            return (
              <li key={label} className="flex-1">
                <Link
                  href={href}
                  className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${
                    active ? 'text-primary' : 'text-warm-muted'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
