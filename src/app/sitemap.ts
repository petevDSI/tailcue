import { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://tailcue.com/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [
    {
      url: 'https://tailcue.com',
      lastModified: new Date('2026-06-17'),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: 'https://tailcue.com/checker',
      lastModified: new Date('2026-06-17'),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://tailcue.com/insurance',
      lastModified: new Date('2026-06-18'),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://tailcue.com/blog',
      lastModified: new Date('2026-06-17'),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...blogEntries,
  ]
}
