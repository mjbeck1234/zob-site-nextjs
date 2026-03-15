import { redirect } from 'next/navigation';

type LoginSearchParams = Promise<{ next?: string | string[] }>;

export default async function LoginPage({ searchParams }: { searchParams?: LoginSearchParams }) {
  const resolved = searchParams ? await searchParams : undefined;
  const rawNext = Array.isArray(resolved?.next) ? resolved?.next[0] : resolved?.next;
  const next =
    typeof rawNext === 'string' && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : undefined;

  redirect(next ? `/api/auth/login?next=${encodeURIComponent(next)}` : '/api/auth/login');
}
