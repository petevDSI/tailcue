'use client'

import { useState, useEffect, useRef } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { hasVoted, recordVote } from '@/lib/blog-votes'

export default function BlogVoteWidget({ slug }: { slug: string }) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const viewFired = useRef(false)

  useEffect(() => {
    setVoted(hasVoted(slug))

    // Fire view count once per mount — useRef guard prevents double-fire in StrictMode
    if (!viewFired.current) {
      viewFired.current = true
      fetch('/api/blog/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      }).catch(() => { /* non-critical — ignore network errors */ })
    }
  }, [slug])

  async function handleVote(vote: 'up' | 'down') {
    if (voted || submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/blog/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, vote }),
      })
      recordVote(slug, vote)
      setVoted(vote)
    } catch {
      // non-critical — ignore network errors
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p className="text-sm font-medium text-stone-500">Was this helpful?</p>
      {voted ? (
        <p className="text-sm text-stone-400">Thanks for your feedback.</p>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleVote('up')}
            disabled={submitting}
            aria-label="Yes, helpful"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2
              text-sm font-medium text-stone-600 transition-colors hover:border-green-300
              hover:bg-green-50 hover:text-green-700 disabled:opacity-40"
          >
            <ThumbsUp className="h-4 w-4" />
            Yes
          </button>
          <button
            onClick={() => handleVote('down')}
            disabled={submitting}
            aria-label="No, not helpful"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2
              text-sm font-medium text-stone-600 transition-colors hover:border-red-300
              hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
          >
            <ThumbsDown className="h-4 w-4" />
            No
          </button>
        </div>
      )}
    </div>
  )
}
