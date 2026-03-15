// Very small, ui-oriented HTML decoder/sanitizer.
//
// Some ZOB tables sometimes store HTML with odd entity usage (e.g. "<&sol;b>")
// and we want it to render nicely in the UI.
//
// This is not a full HTML sanitizer; it is a pragmatic, defense-in-depth filter
// to remove obviously dangerous constructs while preserving basic formatting.

function decodeEntities(s: string): string {
  return s
    .replaceAll('&sol;', '/')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&nbsp;', ' ');
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function stripObviousBadness(html: string): string {
  // Remove script blocks entirely.
  let out = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');

  // Remove inline event handlers like onclick="...".
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Neutralize javascript: URLs.
  out = out.replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, ' $1="#"');

  // Remove iframes/objects/embeds.
  out = out.replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/(iframe|object|embed)>/gi, '');
  out = out.replace(/<(iframe|object|embed)([^>]*)\/>/gi, '');

  return out;
}

/**
 * Convert existing notes into safe-ish HTML for rendering.
 * - If the string looks like it already contains tags, we decode odd entities and strip obvious badness.
 * - If it looks like plain text, we escape it and preserve newlines.
 */
export function textToHtml(input: any): string {
  const raw0 = String(input ?? '');
  const decoded = decodeEntities(raw0);
  const looksLikeHtml = /<\s*\/?\s*[a-zA-Z][^>]*>/.test(decoded);

  if (!looksLikeHtml) {
    return escapeHtml(decoded).replace(/\r\n|\r|\n/g, '<br />');
  }

  return stripObviousBadness(decoded);
}
