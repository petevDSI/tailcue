'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PostMeta } from '@/lib/blog'

type SortKey = 'newest' | 'oldest' | 'popular'

type StatRow = {
  upvotes: number
  downvotes: number
  view_count: number
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function popularityScore(stats: StatRow | undefined): number {
  if (!stats) return 0
  return (stats.upvotes - stats.downvotes) * 10 + stats.view_count
}

export default function BlogList({
  posts,
  statsMap,
}: {
  posts: PostMeta[]
  statsMap: Record<string, StatRow>
}) {
  const [sort, setSort] = useState<SortKey>('newest')

  const sorted = [...posts].sort((a, b) => {
    if (sort === 'newest') return a.date < b.date ? 1 : -1
    if (sort === 'oldest') return a.date > b.date ? 1 : -1
    return popularityScore(statsMap[b.slug]) - popularityScore(statsMap[a.slug])
  })

  const tabs: { key: SortKey; label: string }[] = [
    { key: 'newest',  label: 'Newest'       },
    { key: 'oldest',  label: 'Oldest'       },
    { key: 'popular', label: 'Most Popular' },
  ]

  return (
    <>
      {/* Sort control */}
      <div className="mb-7 flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSort(tab.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              sort === tab.key
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Post list */}
      {sorted.length === 0 ? (
        <p className="text-center text-stone-400">No posts yet — check back soon.</p>
      ) : (
        <div className="space-y-5">
          {sorted.map((post) => (
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
    </>
  )
}
