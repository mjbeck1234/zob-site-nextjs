import React from 'react';
import RichText from '@/components/RichText';
import { cn } from '@/lib/utils';

type Props = {
  value?: string | null;
  className?: string;
  /** When true, tries to format plain text into headings + bullet lists. */
  smartList?: boolean;
};

function decodeHtmlEntities(input: string): string {
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

function stripBulletPrefix(line: string): string {
  return line.replace(/^([\-*•‣▪▫]+\s*)/g, '').trim();
}

function isHeadingLine(line: string): boolean {
  // A safe heuristic: lines that end with ':' and are relatively short.
  return /:\s*$/.test(line) && line.length <= 64;
}

function extractTagNames(html: string): Set<string> {
  const out = new Set<string>();
  const re = /<\/?\s*([a-zA-Z0-9-]+)(?:\s[^>]*)?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.add(String(m[1] ?? '').toLowerCase());
  }
  return out;
}

function maybeBasicHtmlToText(html: string): string | null {
  // Some existing fields are stored as very simple HTML (mostly <br>, <p>, <div>, <span>).
  // When that's the case, converting to plain text gives us nicer bullet-list formatting.
  const tags = extractTagNames(html);
  if (!tags.size) return null;

  const allowed = new Set(['br', 'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'a', 'font', 'small', 'big', 'sup', 'sub', 'o:p']);
  for (const t of tags) {
    if (!allowed.has(t)) return null;
  }

  // Convert common simple tags into newlines, then strip the remaining tags.
  const text = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<\s*p\b[^>]*>/gi, '')
    .replace(/<\s*\/\s*div\s*>/gi, '\n')
    .replace(/<\s*div\b[^>]*>/gi, '')
    .replace(/<\s*\/\s*span\s*>/gi, '')
    .replace(/<\s*span\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text || null;
}

export default function LessonPlanText({ value, className, smartList = true }: Props) {
  const raw = (value ?? '').toString();
  if (!raw.trim()) {
    return <div className={cn('text-white/60', className)}>—</div>;
  }

  const decoded = decodeHtmlEntities(raw);
  let normalized = decoded;
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(decoded);
  if (looksLikeHtml) {
    const maybeText = maybeBasicHtmlToText(decoded);
    if (!maybeText) {
      return <RichText value={decoded} className={cn('lesson-richtext', className)} />;
    }
    // Treat as plain text so we can smart-format lists.
    normalized = maybeText;
  }

  // Plain text.
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!smartList || lines.length <= 1) {
    return <div className={cn('whitespace-pre-wrap text-white/85', className)}>{normalized}</div>;
  }

  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = () => {
    if (!list.length) return;
    const items = list.map(stripBulletPrefix).filter(Boolean);
    if (!items.length) {
      list = [];
      return;
    }
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-5 list-disc space-y-1">
        {items.map((t, idx) => (
          <li key={idx} className="text-white/85">
            {t}
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const line of lines) {
    if (isHeadingLine(line)) {
      flush();
      blocks.push(
        <div key={`h-${blocks.length}`} className="mt-3 font-semibold text-white">
          {line.replace(/:\s*$/, '')}
        </div>
      );
      continue;
    }
    list.push(line);
  }
  flush();

  return <div className={cn('space-y-2 text-white/85', className)}>{blocks}</div>;
}
