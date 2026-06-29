import { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { getAllPricePageParams } from '@/lib/prices-data'
import { getAllFoodPageParams } from '@/lib/food-data'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, priceParams, foodParams] = await Promise.all([
    Promise.resolve(getAllPosts()),
    getAllPricePageParams(),
    getAllFoodPageParams(),
  ])

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://tailcue.com/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const priceEntries: MetadataRoute.Sitemap = priceParams.map(({ species, procedure, city }) => ({
    url: `https://tailcue.com/prices/${species}/${procedure}/${city}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const foodEntries: MetadataRoute.Sitemap = foodParams.map(({ species, food }) => ({
    url: `https://tailcue.com/can-my-pet-eat/${species}/${food}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
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
    {
      url: 'https://tailcue.com/can-my-pet-eat',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...blogEntries,
    ...priceEntries,
    ...foodEntries,
  ]
}
