import React from 'react';

type Props = {
  value?: string | null;
  className?: string;
};

function decodeHtmlEntities(input: string): string {
  // Decode the common entities we see in existing WYSIWYG exports, plus numeric entities.
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    })
    .replace(/&#(\d+);/g, (_, num) => {
      try {
        return String.fromCharCode(parseInt(num, 10));
      } catch {
        return _;
      }
    });
}

function stripDangerousHtml(html: string): string {
  let out = html;
  // Remove script-like tags entirely.
  out = out.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  out = out.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
  out = out.replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '');
  out = out.replace(/<\s*embed[^>]*>[\s\S]*?<\s*\/\s*embed\s*>/gi, '');

  // Drop inline event handlers like onclick="...".
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Neutralize javascript: URLs.
  out = out.replace(/\shref\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, ' href="#"');
  out = out.replace(/\ssrc\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '');

  return out;
}

export default function RichText({ value, className }: Props) {
  const raw = (value ?? '').toString();
  if (!raw.trim()) return null;

  const decoded = decodeHtmlEntities(raw);
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(decoded);

  if (looksLikeHtml) {
    const safe = stripDangerousHtml(decoded);
    return <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />;
  }

  return <div className={`${className ?? ''} whitespace-pre-wrap`}>{decoded}</div>;
}
