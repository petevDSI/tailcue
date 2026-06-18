import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Home',        href: '/'          },
  { label: 'Price Check', href: '/checker'   },
  { label: 'Insurance',   href: '/insurance' },
  { label: 'Articles',    href: '/blog'      },
]

export default function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white py-6 text-center">
      <nav className="mb-3 flex flex-wrap items-center justify-center">
        {NAV_LINKS.map((link, i) => (
          <span key={link.href} className="flex items-center">
            {i > 0 && <span className="mx-2 text-stone-300">·</span>}
            <Link href={link.href} className="text-xs text-stone-400 hover:underline">
              {link.label}
            </Link>
          </span>
        ))}
      </nav>
      <p className="text-xs text-stone-400">
        Benchmark prices based on NAPHIA SOI 2025 and published industry data. For educational
        purposes only — not a substitute for veterinary advice.
      </p>
    </footer>
  )
}
