import type { MetadataRoute } from 'next';

import { site } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const host = site.domain.replace(/^https?:\/\//, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `https://${host}/sitemap.xml`,
    host: `https://${host}`,
  };
}
