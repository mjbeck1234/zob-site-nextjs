import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { canAccessSeniorStaff, canModerateLoa } from '@/lib/auth/permissions';
import { canModerateFeedback } from '@/lib/auth/feedback';

export default async function AdminManagementPage() {
  const user = await requireAdmin();

  // Senior staff only (DATM/ADATM/TA) + Admin
  if (!canAccessSeniorStaff(user)) {
    redirect('/admin?forbidden=management');
  }

  const canFeedback = canModerateFeedback(user);
  const canLoa = canModerateLoa(user);

  // This page used to be a card hub. Keep the route for compatibility, but
  // send users straight to a tool they can use.
  if (canFeedback) redirect('/admin/feedback');
  if (canLoa) redirect('/admin/loa');

  // If they somehow have senior staff access but no tools, send them back.
  redirect('/admin?forbidden=management');
}
