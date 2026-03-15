import IDSClient from './IDSClient';
import { requireIdsAccess } from '@/lib/auth/guards';

export default async function IDSPage() {
  await requireIdsAccess();
  // IDS is a tool-like page: no PageShell hero/title; just offset for the fixed navbar.
  // If your navbar height changes, adjust mt-16 accordingly.
  return (
    <div className="mt-16 w-full px-4">
      <IDSClient />
    </div>
  );
}
