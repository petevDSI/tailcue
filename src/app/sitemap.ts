import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
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
  ]
}
