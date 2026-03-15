import type { MetadataRoute } from 'next';

import { site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const host = `https://${site.domain.replace(/^https?:\/\//, '')}`;
  const now = new Date();

  const routes = [
    '/',
    '/events',
    '/pilot/resources',
    '/pilot/ramp',
    '/learning',
    '/learning/cbts',
    '/learning/syllabus',
    '/ids',
    '/splits',
    '/briefing',
    '/downloads',
    '/roster',
    '/visit',
  ];

  return routes.map((route) => ({
    url: `${host}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : route.startsWith('/pilot') || route.startsWith('/learning') ? 0.8 : 0.7,
  }));
}
