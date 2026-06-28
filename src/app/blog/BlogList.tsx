'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import type { PostMeta } from '@/lib/blog'

const PAGE_SIZE = 6

type SortKey = 'newest' | 'oldest' | 'popular'

type StatRow = {
  upvotes: number
  downvotes: number
  view_count: number
}

const TAG_LABELS: Record<string, string> = {
  'dogs': 'Dogs',
  'cats': 'Cats',
  'costs': 'Costs',
  'surgery': 'Surgery',
  'insurance': 'Insurance',
  'diabetes': 'Diabetes',
  'monitoring': 'Monitoring',
  'chronic-conditions': 'Chronic Conditions',
  'heart-disease': 'Heart Disease',
  'emergencies': 'Emergencies',
  'hyperthyroidism': 'Hyperthyroidism',
  'cushings': "Cushing's",
  'epilepsy': 'Epilepsy',
  'kidney-disease': 'Kidney Disease',
}

function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
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
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const post of posts) {
      for (const tag of post.tags) {
        counts[tag] = (counts[tag] ?? 0) + 1
      }
    }
    return counts
  }, [posts])

  const allTags = useMemo(
    () => Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag]) => tag),
    [tagCounts]
  )

  const maxCount = useMemo(() => Math.max(...Object.values(tagCounts), 1), [tagCounts])

  const sorted = useMemo(() => [...posts].sort((a, b) => {
    if (sort === 'newest') return a.date < b.date ? 1 : -1
    if (sort === 'oldest') return a.date > b.date ? 1 : -1
    return popularityScore(statsMap[b.slug]) - popularityScore(statsMap[a.slug])
  }), [posts, sort, statsMap])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sorted.filter((post) => {
      if (activeTag && !post.tags.includes(activeTag)) return false
      if (!q) return true
      return (
        post.title.toLowerCase().includes(q) ||
        post.description.toLowerCase().includes(q) ||
        post.tags.some((t) => tagLabel(t).toLowerCase().includes(q))
      )
    })
  }, [sorted, search, activeTag])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSearch(val: string) {
    setSearch(val)
    setPage(1)
  }

  function handleTag(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag))
    setPage(1)
  }

  function clearFilters() {
    setSearch('')
    setActiveTag(null)
    setPage(1)
  }

  const hasFilters = search.trim() !== '' || activeTag !== null

  const tabs: { key: SortKey; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'oldest', label: 'Oldest' },
    { key: 'popular', label: 'Most Popular' },
  ]

  return (
    <>
      {/* Sort control */}
      <div className="mb-5 flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 w-fit">
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

      {/* Search box */}
      <div className="mb-5 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search posts…"
          className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-9 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Topic cloud */}
      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {allTags.map((tag) => {
            const freq = tagCounts[tag]
            const size = 0.75 + (freq / maxCount) * 0.35
            const isActive = activeTag === tag
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTag(tag)}
                style={{ fontSize: `${size}rem` }}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tagLabel(tag)}
              </button>
            )
          })}
        </div>
      )}

      {/* Result count + clear */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-400">
          {filtered.length} {filtered.length === 1 ? 'post' : 'posts'}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-amber-600 hover:text-amber-700 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Post list */}
      {visible.length === 0 ? (
        <p className="text-center text-stone-400 py-8">No posts match — try a different search.</p>
      ) : (
        <div className="space-y-5">
          {visible.map((post) => (
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
              {post.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500"
                    >
                      {tagLabel(tag)}
                    </span>
                  ))}
                </div>
              )}
              <span className="mt-4 inline-block text-sm font-semibold text-amber-600">
                Read more →
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-stone-800 disabled:opacity-30"
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                n === safePage
                  ? 'bg-amber-500 text-white'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-stone-800 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </>
  )
}
