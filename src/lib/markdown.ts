import { marked } from 'marked';

// Minimal markdown -> HTML helper.
// NOTE: We do not sanitize here because this content is staff-authored.
// If you later allow public editing, add sanitization (e.g. DOMPurify on server).

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function mdToHtml(md: string): string {
  return marked.parse(md ?? '') as unknown as string;
}
