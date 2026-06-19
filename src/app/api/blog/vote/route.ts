import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { slug, vote } = await req.json()
    if (!slug || typeof slug !== 'string' || (vote !== 'up' && vote !== 'down')) {
      return NextResponse.json({ error: 'slug and vote ("up"|"down") required' }, { status: 400 })
    }
    const { error } = await supabase.rpc('increment_blog_vote', { p_slug: slug, p_vote: vote })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
