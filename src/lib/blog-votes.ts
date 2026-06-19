const STORAGE_KEY = 'tailcue_blog_votes'

export function hasVoted(slug: string): 'up' | 'down' | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const votes = JSON.parse(raw) as Record<string, 'up' | 'down'>
    return votes[slug] ?? null
  } catch {
    return null
  }
}

export function recordVote(slug: string, vote: 'up' | 'down'): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const votes: Record<string, 'up' | 'down'> = raw ? JSON.parse(raw) : {}
    votes[slug] = vote
    localStorage.setItem(STORAGE_KEY, JSON.stringify(votes))
  } catch {
    // storage quota exceeded — fail silently
  }
}
