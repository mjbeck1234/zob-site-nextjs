import React from 'react';

import { textToHtml } from '@/lib/htmlContent';

export default function HtmlContent({ html, className }: { html: any; className?: string }) {
  const safe = textToHtml(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />;
}
