import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { getAllPosts } from '@/lib/blog'
import Footer from '@/components/footer'

export const metadata = {
  title: 'Blog — Tailcue',
  description: 'Helping pet owners make smarter decisions about veterinary care and costs.',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
              <PawPrint className="h-5 w-5 text-white" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-stone-900">Tailcue</span>
          </Link>
          <Link
            href="/checker"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
          >
            Check a Quote →
          </Link>
        </div>
      </header>

      {/* Page header */}
      <section className="border-b border-stone-100 bg-gradient-to-b from-amber-50 to-stone-50 px-6 py-12 text-center">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-2 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight text-stone-900">
            Tailcue Blog
          </h1>
          <p className="text-base text-stone-500">Helping pet owners make smarter decisions</p>
        </div>
      </section>

      {/* Post list */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        {posts.length === 0 ? (
          <p className="text-center text-stone-400">No posts yet — check back soon.</p>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <time className="mb-2 block text-xs font-medium text-stone-400">
                  {formatDate(post.date)}
                </time>
                <h2 className="mb-1.5 text-[17px] font-bold leading-snug text-stone-900">
                  {post.title}
                </h2>
                <p className="text-sm leading-relaxed text-stone-500">{post.description}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-amber-600">
                  Read more →
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />

    </div>
  )
}
