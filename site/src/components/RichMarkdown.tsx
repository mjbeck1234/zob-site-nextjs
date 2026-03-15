import React from 'react';

import { marked } from 'marked';

import { textToHtml } from '@/lib/htmlContent';

/**
 * Render existing markdown-ish content safely.
 *
 * - Uses `marked` to convert markdown -> HTML.
 * - Runs the output through our existing sanitizer/decoder to handle odd entities
 *   like `<&sol;b>` and strip obvious unsafe constructs.
 */
export default function RichMarkdown({
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

  const safe = textToHtml(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />;
}
