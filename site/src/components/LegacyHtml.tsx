import React from 'react';

import { legacyToHtml } from '@/lib/legacyHtml';

export default function LegacyHtml({ html, className }: { html: any; className?: string }) {
  const safe = legacyToHtml(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />;
}
