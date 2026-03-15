import React from 'react';

import { marked } from 'marked';

import { legacyToHtml } from '@/lib/legacyHtml';

/**
 * Render legacy markdown-ish content safely.
 *
 * - Uses `marked` to convert markdown -> HTML.
 * - Runs the output through our legacy sanitizer/decoder to handle odd entities
 *   like `<&sol;b>` and strip obvious unsafe constructs.
 */
export default function LegacyMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const md = String(content ?? '');

  // `marked.parse` returns a string for sync usage.
  const html = marked.parse(md, {
    gfm: true,
    breaks: true,
  }) as string;

  const safe = legacyToHtml(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />;
}
