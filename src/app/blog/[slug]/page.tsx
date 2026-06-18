import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getAllPosts, getPostBySlug } from '@/lib/blog'

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug)
  if (!post) return {}
  return {
    title: `${post.title} — Tailcue`,
    description: post.description,
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug)
  if (!post) notFound()

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

      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* Back link */}
        <Link href="/blog" className="mb-8 inline-flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600">
          ← All posts
        </Link>

        {/* Post header */}
        <div className="mb-8 mt-4">
          <time className="mb-3 block text-xs font-medium text-stone-400">{formatDate(post.date)}</time>
          <h1 className="mb-3 text-[clamp(24px,4vw,34px)] font-extrabold leading-tight tracking-tight text-stone-900">
            {post.title}
          </h1>
          <p className="text-base leading-relaxed text-stone-500">{post.description}</p>
        </div>

        <hr className="mb-8 border-stone-200" />

        {/* MDX content */}
        <div className="prose prose-stone prose-base max-w-none leading-relaxed
          prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-stone-900
          prose-p:text-stone-700 prose-p:leading-relaxed
          prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-stone-900
          prose-li:text-stone-700
        ">
          <MDXRemote source={post.content} />
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="mb-3 font-semibold text-stone-800">Got a vet quote? See if it&apos;s fair.</p>
          <Link
            href="/checker"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-500 px-5 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-600"
          >
            Check My Quote →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 text-center">
        <p className="text-xs text-stone-400">
          Benchmark prices based on NAPHIA SOI 2025 and published industry data. For educational purposes only — not a substitute for veterinary advice.
        </p>
      </footer>

    </div>
  )
}
